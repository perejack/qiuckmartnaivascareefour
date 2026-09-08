declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/** Your new Google Ads Measurement ID (updated from old AW-18339005888). */
export const GOOGLE_ADS_ID = "AW-18409428048";

/**
 * The "send_to" conversion label for the Purchase/payment-confirmed action.
 * ⚠️  Replace the label part (after the slash) with the real one from:
 *   Google Ads → Goals → Conversions → your conversion → "Tag setup" tab.
 * It looks like: AW-XXXXXXXXX/YYYYYYYYYYY
 *
 * Once you create the conversion action in Google Ads (Category: Purchase),
 * copy the full send_to string here.
 */
export const GOOGLE_ADS_CONVERSION_SEND_TO = "AW-18409428048/pjLoCLT8hugcENCopspE";

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

  window.gtag("event", "conversion", {
    send_to: GOOGLE_ADS_CONVERSION_SEND_TO,
    // transaction_id prevents Google Ads from counting the same payment twice
    // if the confirmation page is refreshed or visited again.
    ...(applicationId ? { transaction_id: applicationId } : {}),
    // value + currency enable value-based bidding ("Maximize Conversion Value").
    // Without these, Google Ads counts conversions but can't optimise for revenue.
    ...(value != null ? { value, currency } : {}),
  });
}
