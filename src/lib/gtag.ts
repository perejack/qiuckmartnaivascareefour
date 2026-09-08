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
 * Fire both Google Ads Purchase conversion and standard GTM dataLayer events
 * once per confirmed payment.
 * Called only from the Confirmation page, after HashPay confirms payment.
 */
export function trackPurchaseConversion({
  applicationId,
  value,
  currency = "KES",
}: ConversionParams = {}) {
  if (typeof window === "undefined") return;

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

  // 1. Google Tag Manager / GTM Custom Event (Pushes to dataLayer)
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "lead_form_submitted",
    conversion_type: "payment_success",
    transaction_id: applicationId || `ORDER_${Date.now()}`,
    value: value ?? 150,
    currency: currency,
    supermarket_application_id: applicationId,
  });

  window.dataLayer.push({
    event: "payment_success",
    transaction_id: applicationId || `ORDER_${Date.now()}`,
    value: value ?? 150,
    currency: currency,
  });

  // 2. Direct gtag Google Ads primary conversion event
  if (typeof window.gtag === "function") {
    window.gtag("event", "conversion", {
      send_to: GOOGLE_ADS_CONVERSION_SEND_TO,
      ...(applicationId ? { transaction_id: applicationId } : {}),
      ...(value != null ? { value, currency } : {}),
    });

    // 3. Standard GA4/Google Ads 'purchase' event
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
}
