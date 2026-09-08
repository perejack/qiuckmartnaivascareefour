import {
  domainAcceptsMail,
  getEmailDomain,
  isKnownEmailProvider,
  validateEmail,
} from "./lib/serverEmail";

type Req = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

type Res = {
  status: (code: number) => Res;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: (data?: unknown) => void;
};

const setCors = (req: Req, res: Res) => {
  const origin = (req.headers?.origin as string | undefined) ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (body ?? {}) as Record<string, unknown>;
}

export default async function handler(req: Req, res: Res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, deliverable: false, error: "Method not allowed" });
    return;
  }

  const body = parseBody(req.body);
  const email = String(body.email ?? "").trim().toLowerCase();
  const validation = validateEmail(email);

  if (!validation.valid) {
    res.status(400).json({
      ok: false,
      deliverable: false,
      error: validation.error || "Enter a valid email address",
      suggestion: validation.suggestion,
    });
    return;
  }

  const domain = getEmailDomain(email);
  if (!domain) {
    res.status(400).json({
      ok: false,
      deliverable: false,
      error: "Enter a valid email address",
    });
    return;
  }

  if (isKnownEmailProvider(domain)) {
    res.status(200).json({ ok: true, deliverable: true, domain, source: "known-provider" });
    return;
  }

  try {
    const deliverable = await domainAcceptsMail(domain);
    if (!deliverable) {
      res.status(200).json({
        ok: true,
        deliverable: false,
        domain,
        error: `"${domain}" does not look like a real email provider. Please check for typos.`,
      });
      return;
    }

    res.status(200).json({ ok: true, deliverable: true, domain, source: "mx-check" });
  } catch {
    res.status(503).json({
      ok: false,
      deliverable: false,
      error: "Could not verify this email right now. Please try again.",
    });
  }
}
