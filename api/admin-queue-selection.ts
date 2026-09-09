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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token");
};

const readAdminToken = (req: Req) => {
  const headerToken =
    (req.headers?.["x-admin-token"] as string | undefined) ||
    (req.headers?.["X-Admin-Token"] as string | undefined);

  const auth = (req.headers?.authorization as string | undefined) || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

  return (headerToken || bearer || "").trim();
};

export default async function handler(req: Req, res: Res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const expectedToken = (process.env.ADMIN_DASHBOARD_TOKEN || "").trim();
  const token = readAdminToken(req);
  if (expectedToken && token !== expectedToken) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  if (!getSupabaseServerConfig()) {
    res.status(503).json({
      ok: false,
      error: "Missing Supabase service role env var (SUPABASE_SERVICE_ROLE_KEY).",
    });
    return;
  }

  // Defensive body parse
  let body: any = req.body ?? {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const toEmail = String(body?.toEmail || "").trim();
  const applicantName = String(body?.applicantName || "").trim();
  const position = String(body?.position || "").trim();
  const supermarket = String(body?.supermarket || "").trim();
  const applicationId = body?.applicationId ? String(body.applicationId).trim() : "";

  if (!toEmail) {
    res.status(400).json({ ok: false, error: "Missing toEmail" });
    return;
  }

  const safeName = applicantName || "{ApplicantName}";
  const safePosition = position || "{Position}";
  const safeSupermarket = supermarket || "{Supermarket}";
  const safeRef = applicationId || "{ApplicationId}";

  const subject = `You've Been Selected – ${safePosition} | ${safeSupermarket} Recruitment`;

  // EXACT message content (word-for-word) as requested for testing
  const message =
    `Hello ${safeName},\n\n` +
    `Thank you for your patience since submitting your application for the ${safePosition} role at ${safeSupermarket} (Ref: ${safeRef}).\n\n` +
    `We are pleased to inform you that following our review of all applications received, and due to a limited number of applicants for this intake, you have been automatically selected to proceed to the next stage of our recruitment process.\n\n` +
    `As a result, the interview stage will not be required at this time. You are confirmed as a selected candidate for the ${safePosition} position at ${safeSupermarket}.\n\n` +
    `What Happens Next\n\n` +
    `Once the current recruitment round is complete, our HR team will be in touch with full details of your orientation, including:\n\n` +
    `• Confirmed date(s) and time(s)\n` +
    `• Venue and branch location\n` +
    `• What to bring and how to prepare\n\n` +
    `Please ensure your contact details are up to date so we can reach you promptly. If any of your details have changed, simply reply to this email.\n\n` +
    `We look forward to welcoming you to the ${safeSupermarket} team.\n\n` +
    `Warm regards,\n` +
    `Hiring Team\n` +
    `${safeSupermarket} Recruitment`;

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    res.status(503).json({ ok: false, error: "Supabase client unavailable." });
    return;
  }

  const sendAt = new Date().toISOString(); // send as soon as cron runs (or resend manually)

  const { error } = await supabase.from("pending_auto_replies").insert({
    send_at: sendAt,
    application_id: applicationId || null,
    applicant_name: applicantName || null,
    to_email: toEmail,
    subject,
    message,
  });

  if (error) {
    res.status(500).json({ ok: false, error: "Failed to queue selection email", detail: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
