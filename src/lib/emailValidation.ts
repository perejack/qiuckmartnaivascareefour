export type EmailValidationResult = {
  valid: boolean;
  formatValid: boolean;
  error?: string;
  suggestion?: string;
};

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Domains that are almost always typos of a well-known provider. */
const TYPO_DOMAINS: Record<string, string> = {
  "gmal.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmali.com": "gmail.com",
  "gmaik.com": "gmail.com",
  "gemail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.comm": "gmail.com",
  "gmail.om": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yhoo.com": "yahoo.com",
  "yaoo.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "homtail.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outllok.com": "outlook.com",
  "outloook.com": "outlook.com",
  "outlook.con": "outlook.com",
  "iclod.com": "icloud.com",
  "icloud.con": "icloud.com",
  "live.con": "live.com",
  "live.co": "live.com",
};

const KNOWN_PROVIDERS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.ke",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "live.com",
  "proton.me",
  "protonmail.com",
];

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[m][n];
}

function buildSuggestion(localPart: string, domain: string): string {
  return `${localPart}@${domain}`;
}

export function getEmailDomain(email: string): string | null {
  const trimmed = (email || "").trim();
  if (!EMAIL_FORMAT.test(trimmed)) return null;
  return trimmed.slice(trimmed.lastIndexOf("@") + 1).toLowerCase();
}

export function isKnownEmailProvider(domain: string): boolean {
  return KNOWN_PROVIDERS.includes(domain.toLowerCase());
}

export function validateEmail(value?: string): EmailValidationResult {
  const trimmed = (value || "").trim();

  if (!trimmed) {
    return { valid: false, formatValid: false, error: "Email is required" };
  }

  if (!EMAIL_FORMAT.test(trimmed)) {
    return {
      valid: false,
      formatValid: false,
      error: "Enter a valid email address (e.g. name@gmail.com)",
    };
  }

  const atIndex = trimmed.lastIndexOf("@");
  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1).toLowerCase();

  const mappedDomain = TYPO_DOMAINS[domain];
  if (mappedDomain) {
    return {
      valid: false,
      formatValid: true,
      error: `"${domain}" looks like a typo`,
      suggestion: buildSuggestion(localPart, mappedDomain),
    };
  }

  if (KNOWN_PROVIDERS.includes(domain)) {
    return { valid: true, formatValid: true };
  }

  // Close typo against common providers (e.g. gmali.com → gmail.com).
  for (const known of KNOWN_PROVIDERS) {
    const distance = levenshtein(domain, known);
    if (distance >= 1 && distance <= 2 && Math.abs(domain.length - known.length) <= 1) {
      return {
        valid: false,
        formatValid: true,
        error: `"${domain}" may be a typo`,
        suggestion: buildSuggestion(localPart, known),
      };
    }
  }

  return { valid: true, formatValid: true };
}

export function isValidEmail(value?: string): boolean {
  return validateEmail(value).valid;
}
