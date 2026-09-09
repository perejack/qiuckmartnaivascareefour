import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

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

function buildFromAddress(smtpUser: string): string {
  const fromEmail = process.env.SMTP_FROM?.trim() || smtpUser;
  const fromName = process.env.SMTP_FROM_NAME?.trim() || "Supermarket Hiring Team";
  return `"${fromName}" <${fromEmail}>`;
}

function buildReplyTo(): string | undefined {
  const replyTo = (
    process.env.REPLY_TO_EMAIL ||
    process.env.FORWARD_TO_EMAIL ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER
  )?.trim();
  return replyTo || undefined;
}

function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>\n");
}

function buildApplicantMailOptions(
  from: string,
  to: string,
  subject: string,
  message: string
) {
  const replyTo = buildReplyTo();
  const siteUrl = (process.env.VITE_APP_URL || "https://www.supermarkethiring.space").replace(/\/+$/, "");
  const footerText = `\n\n--\nSupermarket Hiring Team\n${siteUrl}\nReply to this email if you have questions.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f6f6;">
<div style="max-width:600px;margin:24px auto;background:#fff;border:1px solid #e8e8e8;border-radius:8px;padding:24px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;">
${textToHtml(message)}
<hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
<p style="font-size:12px;color:#666;margin:0;">
<strong>Supermarket Hiring Team</strong><br>
<a href="${siteUrl}" style="color:#2563eb;">${siteUrl.replace(/^https?:\/\//, "")}</a><br>
If you have questions, reply to this email.
</p>
</div>
</body>
</html>`;

  return {
    from,
    to,
    subject,
    text: message + footerText,
    html,
    ...(replyTo ? { replyTo } : {}),
    headers: {
      Importance: "normal",
      "X-Priority": "3",
    },
  };
}

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  url?: string;
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
  try {
    await runHandler(req, res);
  } catch (e: any) {
    res.status(500).json({
      ok: false,
      error: "Unhandled server error",
      detail: e?.message ? String(e.message) : String(e),
    });
  }
}

async function runHandler(req: Req, res: Res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Vercel Cron calls this via GET by default. We also allow POST for manual triggers.
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  // Optional protection: if CRON_TOKEN is set, require it via query param (?token=...).
  // This prevents random visitors from triggering email sends.
  const expectedCronToken = (process.env.CRON_TOKEN || "").trim();
  if (expectedCronToken) {
    const url = req.url || "";
    const tokenMatch = url.match(/[?&]token=([^&]+)/i);
    const token = tokenMatch ? decodeURIComponent(tokenMatch[1] || "") : "";
    if (!token || token !== expectedCronToken) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }
  }

  const supabaseConfig = getSupabaseServerConfig();
  if (!supabaseConfig) {
    res.status(503).json({
      ok: false,
      error: "Auto-reply is not configured (missing SUPABASE_SERVICE_ROLE_KEY).",
    });
    return;
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, "");
  if (!smtpHost || !smtpUser || !smtpPass) {
    res.status(503).json({
      ok: false,
      error: "Auto-reply is not configured (missing SMTP env vars).",
    });
    return;
  }

  const from = buildFromAddress(smtpUser);
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    res.status(503).json({
      ok: false,
      error: "Auto-reply is not configured (Supabase client unavailable).",
    });
    return;
  }

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("pending_auto_replies")
    .select("id,to_email,subject,message")
    .is("sent_at", null)
    .lte("send_at", nowIso)
    .eq("status", "pending")
    .order("send_at", { ascending: true })
    .limit(20);

  if (error) {
    res.status(500).json({ ok: false, error: "Failed to load pending replies", detail: error.message });
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const row of due || []) {
    try {
      await transporter.sendMail(
        buildApplicantMailOptions(
          from,
          String(row.to_email),
          String(row.subject),
          String(row.message)
        )
      );

      await supabase
        .from("pending_auto_replies")
        .update({ sent_at: new Date().toISOString(), status: "sent", last_error: null })
        .eq("id", row.id);

      sent++;
    } catch (e: any) {
      failed++;
      await supabase
        .from("pending_auto_replies")
        .update({
          status: "failed",
          last_error: e?.message ? String(e.message) : String(e),
        })
        .eq("id", row.id);
    }
  }

  res.status(200).json({ ok: true, processed: (due || []).length, sent, failed });
}
