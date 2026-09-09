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

type Req = {
  method?: string;
  body?: any;
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

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    res.status(503).json({
      ok: false,
      error: "Supabase client unavailable.",
    });
    return;
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("pending_auto_replies")
      .select(
        "id,created_at,send_at,sent_at,status,last_error,application_id,applicant_name,to_email,subject"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      res.status(500).json({ ok: false, error: "Failed to load auto replies", detail: error.message });
      return;
    }

    res.status(200).json({ ok: true, rows: data || [] });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
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

  const id = (body?.id ? String(body.id) : "").trim();
  if (!id) {
    res.status(400).json({ ok: false, error: "Missing id" });
    return;
  }

  const { data: row, error: rowErr } = await supabase
    .from("pending_auto_replies")
    .select("id,to_email,subject,message")
    .eq("id", id)
    .maybeSingle();

  if (rowErr || !row) {
    res.status(404).json({ ok: false, error: "Reply not found" });
    return;
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, "");
  if (!smtpHost || !smtpUser || !smtpPass) {
    res.status(503).json({ ok: false, error: "Missing SMTP env vars" });
    return;
  }

  const from = process.env.SMTP_FROM?.trim() || smtpUser;
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    await transporter.sendMail({
      from,
      to: String(row.to_email),
      subject: String(row.subject),
      text: String(row.message),
    });

    await supabase
      .from("pending_auto_replies")
      .update({ sent_at: new Date().toISOString(), status: "sent", last_error: null })
      .eq("id", row.id);

    res.status(200).json({ ok: true });
  } catch (e: any) {
    await supabase
      .from("pending_auto_replies")
      .update({ status: "failed", last_error: e?.message ? String(e.message) : String(e) })
      .eq("id", row.id);

    res.status(500).json({
      ok: false,
      error: "Failed to resend",
      detail: e?.message ? String(e.message) : String(e),
    });
  }
}

