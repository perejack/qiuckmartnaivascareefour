type TikTokIdentifyPayload = {
  email?: string;
  phone_number?: string;
  external_id?: string;
};

type TikTokQueue = {
  track: (event: string, params?: Record<string, unknown>) => void;
  identify: (payload: TikTokIdentifyPayload) => void;
  page: () => void;
};

declare global {
  interface Window {
    ttq?: TikTokQueue;
  }
}

export const TIKTOK_PIXEL_ID = "D9M75HBC77U97D5Q2FJ0";

/**
 * Normalize Kenyan phones for TikTok identify (E.164).
 * Supports: +2547…, +254115…, 07…, 0115…, 2547…, 254115…, 7…, 115…
 */
export function toE164Phone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const cleaned = phone.trim();
  if (!cleaned || /^(null|undefined)$/i.test(cleaned)) return undefined;

  const onlyDigits = cleaned.replace(/\D/g, "");
  if (!onlyDigits) return undefined;

  let national: string | undefined;

  if (onlyDigits.startsWith("254") && onlyDigits.length >= 12) {
    // 2547xxxxxxxx or 254115xxxxxx
    national = onlyDigits.slice(3);
  } else if (onlyDigits.startsWith("0") && onlyDigits.length >= 10) {
    // 07xxxxxxxx or 0115xxxxxx
    national = onlyDigits.slice(1);
  } else if (
    onlyDigits.length === 9 &&
    (onlyDigits.startsWith("7") || onlyDigits.startsWith("1"))
  ) {
    // 7xxxxxxxx or 115xxxxxx (no leading 0 / country code)
    national = onlyDigits;
  } else if (cleaned.startsWith("+") && onlyDigits.length >= 10 && onlyDigits.startsWith("254")) {
    national = onlyDigits.slice(3);
  } else {
    return undefined;
  }

  // Kenya national mobile numbers are 9 digits (7xxxxxxxx or 1xxxxxxxx e.g. 115xxxxxx)
  if (!/^[17]\d{8}$/.test(national)) return undefined;

  const e164 = `+254${national}`;
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return undefined;
  return e164;
}

/** Fire TikTok CompletePayment once per application confirmation. */
export function trackTikTokCompletePayment(options?: {
  applicationId?: string;
  email?: string;
  phone?: string;
  value?: number;
  currency?: string;
  contentName?: string;
}) {
  if (typeof window === "undefined" || typeof window.ttq?.track !== "function") return;

  const storageKey = options?.applicationId
    ? `gs_tt_complete_payment_${options.applicationId}`
    : "gs_tt_complete_payment_fired";

  try {
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, new Date().toISOString());
  } catch {
    // ignore storage failures and still attempt to send
  }

  const email = options?.email?.trim();
  const phone = toE164Phone(options?.phone);
  if (email || phone) {
    window.ttq.identify({
      ...(email ? { email } : {}),
      ...(phone ? { phone_number: phone } : {}),
    });
  }

  const rawValue = options?.value;
  const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
  const hasValue = Number.isFinite(value) && value > 0;
  const currency = options?.currency || "KES";
  const contentId = options?.applicationId || "application_fee";

  window.ttq.track("CompletePayment", {
    content_type: "product",
    content_id: contentId,
    content_name: options?.contentName || "Application processing fee",
    currency,
    ...(hasValue
      ? {
          value,
          contents: [
            {
              content_id: contentId,
              content_type: "product",
              content_name: options?.contentName || "Application processing fee",
              quantity: 1,
              price: value,
            },
          ],
        }
      : {}),
  });
}

/** Identify user with TikTok — call when PII is available. TikTok hashes client-side. */
export function trackTikTokIdentify(options?: {
  email?: string;
  phone?: string;
  externalId?: string;
}) {
  if (typeof window === "undefined" || typeof window.ttq?.identify !== "function") return;
  const email = options?.email?.trim();
  const phone = toE164Phone(options?.phone);
  const externalId = options?.externalId?.trim();
  if (email || phone || externalId) {
    window.ttq.identify({
      ...(email ? { email } : {}),
      ...(phone ? { phone_number: phone } : {}),
      ...(externalId ? { external_id: externalId } : {}),
    });
  }
}

/** Track ViewContent — when user views a page with content (job listings, positions). */
export function trackTikTokViewContent(options?: {
  contentId?: string;
  contentName?: string;
  contentType?: string;
  value?: number;
  currency?: string;
}) {
  if (typeof window === "undefined" || typeof window.ttq?.track !== "function") return;
  window.ttq.track("ViewContent", {
    contents: [
      {
        content_id: options?.contentId || "job_listings",
        content_type: options?.contentType || "product",
        content_name: options?.contentName || "Supermarket job vacancies",
      },
    ],
    ...(options?.value ? { value: options.value } : {}),
    currency: options?.currency || "KES",
  });
}

/** Track AddToCart — when user selects a position to apply for. */
export function trackTikTokAddToCart(options?: {
  contentId?: string;
  contentName?: string;
  value?: number;
  currency?: string;
}) {
  if (typeof window === "undefined" || typeof window.ttq?.track !== "function") return;
  window.ttq.track("AddToCart", {
    contents: [
      {
        content_id: options?.contentId || "application",
        content_type: "product",
        content_name: options?.contentName || "Job application",
      },
    ],
    ...(options?.value ? { value: options.value } : {}),
    currency: options?.currency || "KES",
  });
}

/** Track CompleteRegistration — when user completes the application form. */
export function trackTikTokCompleteRegistration(options?: {
  contentId?: string;
  contentName?: string;
  value?: number;
  currency?: string;
}) {
  if (typeof window === "undefined" || typeof window.ttq?.track !== "function") return;
  window.ttq.track("CompleteRegistration", {
    contents: [
      {
        content_id: options?.contentId || "application",
        content_type: "product",
        content_name: options?.contentName || "Job application",
      },
    ],
    ...(options?.value ? { value: options.value } : {}),
    currency: options?.currency || "KES",
  });
}

/** Track InitiateCheckout — when user reaches the payment step. */
export function trackTikTokInitiateCheckout(options?: {
  contentId?: string;
  contentName?: string;
  value?: number;
  currency?: string;
}) {
  if (typeof window === "undefined" || typeof window.ttq?.track !== "function") return;
  window.ttq.track("InitiateCheckout", {
    contents: [
      {
        content_id: options?.contentId || "application_fee",
        content_type: "product",
        content_name: options?.contentName || "Application processing fee",
      },
    ],
    ...(options?.value ? { value: options.value } : {}),
    currency: options?.currency || "KES",
  });
}

/** Track AddPaymentInfo — when user enters M-Pesa number for payment. */
export function trackTikTokAddPaymentInfo(options?: {
  contentId?: string;
  contentName?: string;
  value?: number;
  currency?: string;
}) {
  if (typeof window === "undefined" || typeof window.ttq?.track !== "function") return;
  window.ttq.track("AddPaymentInfo", {
    contents: [
      {
        content_id: options?.contentId || "application_fee",
        content_type: "product",
        content_name: options?.contentName || "Application processing fee",
      },
    ],
    ...(options?.value ? { value: options.value } : {}),
    currency: options?.currency || "KES",
  });
}

/** Track PlaceAnOrder — when payment is submitted. */
export function trackTikTokPlaceAnOrder(options?: {
  applicationId?: string;
  contentName?: string;
  value?: number;
  currency?: string;
}) {
  if (typeof window === "undefined" || typeof window.ttq?.track !== "function") return;
  const contentId = options?.applicationId || "application_fee";
  window.ttq.track("PlaceAnOrder", {
    contents: [
      {
        content_id: contentId,
        content_type: "product",
        content_name: options?.contentName || "Application processing fee",
        quantity: 1,
        ...(options?.value ? { price: options.value } : {}),
      },
    ],
    ...(options?.value ? { value: options.value } : {}),
    currency: options?.currency || "KES",
  });
}

/** Track Purchase — when payment is confirmed. */
export function trackTikTokPurchase(options?: {
  applicationId?: string;
  contentName?: string;
  value?: number;
  currency?: string;
}) {
  if (typeof window === "undefined" || typeof window.ttq?.track !== "function") return;
  const storageKey = options?.applicationId
    ? `gs_tt_purchase_${options.applicationId}`
    : "gs_tt_purchase_fired";
  try {
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, new Date().toISOString());
  } catch {
    // ignore storage failures
  }
  const contentId = options?.applicationId || "application_fee";
  window.ttq.track("Purchase", {
    contents: [
      {
        content_id: contentId,
        content_type: "product",
        content_name: options?.contentName || "Application processing fee",
        quantity: 1,
        ...(options?.value ? { price: options.value } : {}),
      },
    ],
    ...(options?.value ? { value: options.value } : {}),
    currency: options?.currency || "KES",
  });
}

/** SPA page view — call on route changes so TikTok sees each screen. */
export function trackTikTokPageView() {
  if (typeof window === "undefined" || typeof window.ttq?.page !== "function") return;
  window.ttq.page();
}
