declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/** Your active Google Ads Measurement ID */
export const GOOGLE_ADS_ID = "AW-18435275422";

/**
 * The "send_to" conversion label for the Purchase/payment-confirmed action.
 * If you have a specific conversion label from Google Ads (e.g. AW-18435275422/AbCdEfGhIjK),
 * it goes here. Until then, firing AW-18435275422 will log the conversion event directly.
 */
export const GOOGLE_ADS_CONVERSION_SEND_TO = "AW-18435275422";

interface ConversionParams {
  /** The confirmed HashPay application ID — used as the transaction_id to prevent duplicate counting. */
  applicationId?: string;
  /** The actual KES amount paid (e.g. 500). Enables value-based bidding in Google Ads. */
  value?: number;
  /** Currency code — always "KES" for Kenyan Shillings. */
  currency?: string;
}

/**
 * Fire the Google Ads Purchase conversion once per confirmed payment.
 * Called only from the Confirmation page, after HashPay's webhook confirms payment.
 *
 * De-duplicated via sessionStorage so a page refresh doesn't double-count.
 */
export function trackPurchaseConversion({
  applicationId,
  value,
  currency = "KES",
}: ConversionParams = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  // De-duplicate: one conversion per applicationId per session
  const storageKey = applicationId
    ? `gs_ads_conversion_${applicationId}`
    : "gs_ads_conversion_fired";

  try {
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, new Date().toISOString());
  } catch {
    // ignore storage failures — still fire the tag
  }

  // 1. Google Ads primary conversion event
  window.gtag("event", "conversion", {
    send_to: GOOGLE_ADS_CONVERSION_SEND_TO,
    ...(applicationId ? { transaction_id: applicationId } : {}),
    ...(value != null ? { value, currency } : {}),
  });

  // 2. Standard GA4/Google Ads 'purchase' event (captures value and currency across all reports)
  window.gtag("event", "purchase", {
    transaction_id: applicationId || `ORDER_${Date.now()}`,
    value: value ?? 150,
    currency: currency,
    items: [
      {
        item_id: applicationId || "supermarket_app",
        item_name: "Supermarket Application Processing Fee",
        price: value ?? 150,
        quantity: 1,
      },
    ],
  });
}
