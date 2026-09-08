import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { formatOrientationDateText } from "./lib/orientationDate";
import { ensureApplicantEmailDeliverable } from "./lib/serverEmail";

const DEFAULT_SUPABASE_URL = "https://mmizjhxxajhooslhyafb.supabase.co";
const PLACEHOLDER_RE = /your_supabase|example\.com|changeme|placeholder/i;

function looksLikePlaceholder(value: string): boolean {
  return PLACEHOLDER_RE.test(value);
}

function normalizeSupabaseUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let url = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!url || looksLikePlaceholder(url)) return null;
  url = url.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function getSupabaseServerConfig(): { url: string; serviceRoleKey: string } | null {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const url = normalizeSupabaseUrl(rawUrl) || DEFAULT_SUPABASE_URL;
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim().replace(/^['"]|['"]$/g, "");
  if (!serviceRoleKey || looksLikePlaceholder(serviceRoleKey)) return null;
  return { url, serviceRoleKey };
}

function createSupabaseServerClient() {
  const config = getSupabaseServerConfig();
  if (!config) return null;
  return createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false } });
}

type Req = {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
};

type Res = {
  status: (code: number) => Res;
  json: (data: any) => void;
  setHeader: (name: string, value: string) => void;
  end: (data?: any) => void;
};

const setCors = (req: Req, res: Res) => {
  const origin = (req.headers?.origin as string | undefined) ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

export default async function handler(req: Req, res: Res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Health check / debug: helps confirm the serverless function is actually deployed
  // and whether env vars are visible to it (without exposing secrets).
  if (req.method === "GET") {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, "");

    const supabaseConfig = getSupabaseServerConfig();

    res.status(200).json({
      ok: true,
      route: "/api/forward-application",
      configured: Boolean(smtpHost && smtpUser && smtpPass),
      autoReplyConfigured: Boolean(supabaseConfig),
      missing: {
        SMTP_HOST: !smtpHost,
        SMTP_USER: !smtpUser,
        SMTP_PASS: !smtpPass,
        SUPABASE_SERVICE_ROLE_KEY: !supabaseConfig,
      },
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  // Vercel usually parses JSON into req.body, but be defensive in case it's a string.
  let body: any = req.body ?? {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const {
    to,
    subject,
    message,
    replyTo,
    applicationId,
    applicantName,
    applicantPhone,
    supermarket,
    position,
    interviewDate,
    interviewTime,
  } = body ?? {};

  const targetEmail = (to || process.env.FORWARD_TO_EMAIL || "").trim();
  if (!targetEmail) {
    res.status(400).json({ ok: false, error: "Missing target email" });
    return;
  }

  const applicantEmail = replyTo ? String(replyTo).trim() : "";
  if (applicantEmail) {
    const emailCheck = await ensureApplicantEmailDeliverable(applicantEmail);
    if (!emailCheck.ok) {
      res.status(400).json({
        ok: false,
        error: emailCheck.error || "Invalid applicant email address",
        suggestion: emailCheck.suggestion,
      });
      return;
    }
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER?.trim();
  // Gmail “App Passwords” are often copied with spaces (e.g. "xxxx xxxx xxxx xxxx").
  // Normalize by removing whitespace so pasting into Vercel env vars still works.
  const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, "");

  // If SMTP isn't configured, return an error so the frontend can fall back to mailto:
  if (!smtpHost || !smtpUser || !smtpPass) {
    res.status(503).json({
      ok: false,
      error: "Email forwarding is not configured (missing SMTP env vars).",
      missing: {
        SMTP_HOST: !smtpHost,
        SMTP_USER: !smtpUser,
        SMTP_PASS: !smtpPass,
      },
      hint: "If you just added env vars on Vercel, redeploy so this function picks them up.",
    });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const from = process.env.SMTP_FROM?.trim() || smtpUser;
  const safeApplicationId = applicationId ? String(applicationId).trim() : "";
  const supabase = createSupabaseServerClient();

  if (safeApplicationId && supabase) {
    const { data: appRow } = await supabase
      .from("applications")
      .select("forwarded_at")
      .eq("application_id", safeApplicationId)
      .maybeSingle();

    const { count: queuedCount } = await supabase
      .from("pending_auto_replies")
      .select("id", { count: "exact", head: true })
      .eq("application_id", safeApplicationId);

    if (appRow?.forwarded_at || (queuedCount ?? 0) > 0) {
      res.status(409).json({
        ok: false,
        alreadyForwarded: true,
        error: "This application has already been forwarded. No need to send again.",
      });
      return;
    }
  }

  try {
    await transporter.sendMail({
      from,
      to: targetEmail,
      subject: String(subject || "New application forwarded"),
      text: String(message || ""),
      replyTo: replyTo ? String(replyTo) : undefined,
      headers: {
        "X-Application-Id": applicationId ? String(applicationId) : "",
        "X-Applicant-Name": applicantName ? String(applicantName) : "",
        "X-Applicant-Phone": applicantPhone ? String(applicantPhone) : "",
      },
    });

    if (safeApplicationId && supabase) {
      await supabase
        .from("applications")
        .update({ forwarded_at: new Date().toISOString() })
        .eq("application_id", safeApplicationId);
       // ─── EMAIL #1: Confirmation ───────────────────────────────────────────────
    // Sent immediately in this same request via SMTP — no cron needed.
    // This avoids needing a sub-minute cron on Vercel Hobby plan.
    let autoReplyQueued = false;
    let autoReplyQueueError: string | null = null;
    let confirmationSent = false;

    try {
      const applicantEmail = replyTo ? String(replyTo).trim() : "";
      const queueSupabase = supabase ?? createSupabaseServerClient();
      const selectionDelayHours = Number(process.env.AUTO_SELECTION_DELAY_HOURS || "19");
      const selectionDelayMinutes = Number(process.env.AUTO_SELECTION_DELAY_MINUTES || "0");
      const onboardingDelayHours = Number(process.env.AUTO_ONBOARDING_DELAY_HOURS || "24");
      const onboardingDelayMinutes = Number(process.env.AUTO_ONBOARDING_DELAY_MINUTES || "0");
      const employeePortalUrl = (process.env.EMPLOYEE_PORTAL_URL || "https://www.recruitmentstaffportal.online/").trim();
      const supportEmail = (process.env.SUPPORT_EMAIL || process.env.FORWARD_TO_EMAIL || "staffhiringmanager2@gmail.com").trim();
      const orientationDate = formatOrientationDateText();

      const generateStaffNumber = (ref: string) => {
        let hash = 0;
        for (let i = 0; i < ref.length; i++) {
          hash = (hash * 31 + ref.charCodeAt(i)) >>> 0;
        }
        return `STF-${(hash % 90000) + 10000}`;
      };

      if (applicantEmail) {
        const safeApplicantName = applicantName ? String(applicantName).trim() : "";
        const safePosition = position ? String(position).trim() : "";
        const safeSupermarket = supermarket ? String(supermarket).trim() : "";
        const safeInterviewDate = interviewDate ? String(interviewDate).trim() : "";
        const safeInterviewTime = interviewTime ? String(interviewTime).trim() : "";

        const { count: existingQueueCount } = safeApplicationId && queueSupabase
          ? await queueSupabase
              .from("pending_auto_replies")
              .select("id", { count: "exact", head: true })
              .eq("application_id", safeApplicationId)
          : { count: 0 };

        if ((existingQueueCount ?? 0) > 0) {
          autoReplyQueueError = "Auto-replies already queued for this application.";
        } else {
          const defaultSubject = safePosition
            ? `Application received: ${safePosition}`
            : "Application received";
          const confirmSubject = (process.env.AUTO_REPLY_SUBJECT || defaultSubject).trim();

          const jobLine =
            safePosition && safeSupermarket
              ? `for the ${safePosition} role at ${safeSupermarket}`
              : safePosition
              ? `for the ${safePosition} role`
              : "";

          const bookingLines =
            safeInterviewDate || safeInterviewTime
              ? "\n\nInterview booking (as submitted):\n" +
                (safeInterviewDate ? `Date: ${safeInterviewDate}\n` : "") +
                (safeInterviewTime ? `Time: ${safeInterviewTime}\n` : "")
              : "";

          const confirmMessage =
            `Hello${safeApplicantName ? ` ${safeApplicantName}` : ""},\n\n` +
            `We've received your application${jobLine ? ` ${jobLine}` : ""}. ` +
            "Your interview booking has also been recorded.\n\n" +
            "Our team is reviewing your details now. We aim to share feedback within 48 hours.\n" +
            (safeApplicationId ? `\nReference: ${safeApplicationId}` : "") +
            bookingLines +
            "\n\nIf you need to correct any details, reply to this email.\n\n" +
            "Regards,\nHiring Team";

          // ── Send Email #1 immediately (no queue) ──────────────────────────
          try {
            const siteUrl = (process.env.VITE_APP_URL || "https://www.supermarkethiring.space").replace(/\/+$/, "");
            const replyToAddr = buildReplyTo();
            const footerText = `\n\n--\nSupermarket Hiring Team\n${siteUrl}\nReply to this email if you have questions.`;
            const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f6f6;">
<div style="max-width:600px;margin:24px auto;background:#fff;border:1px solid #e8e8e8;border-radius:8px;padding:24px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;">
${confirmMessage.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>\n")}
<hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
<p style="font-size:12px;color:#666;margin:0;">
<strong>Supermarket Hiring Team</strong><br>
<a href="${siteUrl}" style="color:#2563eb;">${siteUrl.replace(/^https?:\/\//, "")}</a><br>
If you have questions, reply to this email.
</p>
</div>
</body>
</html>`;

            await transporter.sendMail({
              from,
              to: applicantEmail,
              subject: confirmSubject,
              text: confirmMessage + footerText,
              html: htmlBody,
              ...(replyToAddr ? { replyTo: replyToAddr } : {}),
              headers: { Importance: "normal", "X-Priority": "3" },
            });
            confirmationSent = true;

            // Mark as sent in Supabase so the cron won't double-send it
            if (queueSupabase) {
              await queueSupabase.from("pending_auto_replies").insert({
                send_at: new Date().toISOString(),
                sent_at: new Date().toISOString(),
                status: "sent",
                application_id: applicationId ? String(applicationId) : null,
                applicant_name: safeApplicantName || null,
                to_email: applicantEmail,
                subject: confirmSubject,
                message: confirmMessage,
              });
            }
          } catch (sendErr: any) {
            // Non-fatal: confirmation failed, but don't block the queue emails
            autoReplyQueueError = `Confirmation send failed: ${sendErr?.message ?? sendErr}`;
          }

          // ── Queue Email #2 (Selection) and Email #3 (Onboarding) for cron ──
          const selectionDelayMs = (selectionDelayHours * 60 + selectionDelayMinutes) * 60 * 1000;
          const selectionSendAt = new Date(Date.now() + selectionDelayMs);
          const selectionSubject = `You've Been Selected – ${safePosition || "{Position}"} | ${safeSupermarket || "{Supermarket}"} Recruitment`;
          const selectionMessage =
            `Hello ${safeApplicantName || "{ApplicantName}"},\n\n` +
            `Thank you for your patience since submitting your application for the ${safePosition || "{Position}"} role at ${safeSupermarket || "{Supermarket}"} (Ref: ${safeApplicationId || "{ApplicationId}"}).\n\n` +
            `We are pleased to inform you that following our review of all applications received, and due to a limited number of applicants for this intake, you have been automatically selected to proceed to the next stage of our recruitment process.\n\n` +
            `As a result, the interview stage will not be required at this time. You are confirmed as a selected candidate for the ${safePosition || "{Position}"} position at ${safeSupermarket || "{Supermarket}"}.\n\n` +
            `What Happens Next\n\n` +
            `Once the current recruitment round is complete, our HR team will be in touch with full details of your orientation, including:\n\n` +
            `• Confirmed date(s) and time(s)\n` +
            `• Venue and branch location\n` +
            `• What to bring and how to prepare\n\n` +
            `Please ensure your contact details are up to date so we can reach you promptly. If any of your details have changed, simply reply to this email.\n\n` +
            `We look forward to welcoming you to the ${safeSupermarket || "{Supermarket}"} team.\n\n` +
            `Warm regards,\n` +
            `Hiring Team\n` +
            `${safeSupermarket || "{Supermarket}"} Recruitment`;

          const onboardingDelayMs = (onboardingDelayHours * 60 + onboardingDelayMinutes) * 60 * 1000;
          const onboardingSendAt = new Date(Date.now() + onboardingDelayMs);
          const staffNumber = generateStaffNumber(safeApplicationId || applicantEmail);
          const onboardingSubject = `Welcome to the team! 🎉`;
          const onboardingMessage =
            `Welcome to the team! 🎉\n\n` +
            `Your staff number is: ${staffNumber}\n\n` +
            "This number will appear on your staff badge. Please use it to log in to the Employee Portal to complete your application, get assigned your branch and access all onboarding resources.\n\n" +
            "Once logged in, you will be able to:\n\n" +
            "📄 Download your work contract\n" +
            "🪪 Apply for your staff ID badge\n" +
            "👕 Apply for your work uniform\n" +
            "📚 Access your training materials\n\n" +
            "Kindly ensure you:\n" +
            "✅ Sign your work contract\n" +
            "✅ Bring the signed copy with you on your orientation day\n\n" +
            `📅 Orientation Date: ${orientationDate}\n` +
            "📍 Venue: Your allocated branch as indicated in your contract\n\n\n\n" +
            "👉 Click this link to confirm and dowload work contract and apply for staff badge\n" +
            `click:${employeePortalUrl}\n\n\n\n` +
            `for any assistance email us ${supportEmail}`;

          if (queueSupabase) {
            const { error: queueError } = await queueSupabase.from("pending_auto_replies").insert([
              {
                send_at: selectionSendAt.toISOString(),
                application_id: applicationId ? String(applicationId) : null,
                applicant_name: safeApplicantName || null,
                to_email: applicantEmail,
                subject: selectionSubject,
                message: selectionMessage,
              },
              {
                send_at: onboardingSendAt.toISOString(),
                application_id: applicationId ? String(applicationId) : null,
                applicant_name: safeApplicantName || null,
                to_email: applicantEmail,
                subject: onboardingSubject,
                message: onboardingMessage,
              },
            ]);

            if (queueError) {
              autoReplyQueueError = queueError.message;
            } else {
              autoReplyQueued = true;
            }
          } else {
            autoReplyQueueError = "Supabase not configured (missing SUPABASE_SERVICE_ROLE_KEY).";
          }
        }
      } else {
        autoReplyQueueError = "Applicant email missing or invalid.";
      }
    } catch (e: any) {
      autoReplyQueueError = e?.message ? String(e.message) : String(e);
    }

    res.status(200).json({ ok: true, confirmationSent, autoReplyQueued, autoReplyQueueError });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: "Failed to send email",
      detail: err?.message ? String(err.message) : String(err),
    });
  }
}
