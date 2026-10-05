declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/** Your active Google Ads Measurement ID */
export const GOOGLE_ADS_ID = "AW-18435275422";

/**
 * Exact Google Ads Conversion label from your screenshot:
 * Conversion ID: 18435275422
 * Conversion label: C3CKCJ6ri_EcEJ71z9ZE
 */
export const GOOGLE_ADS_CONVERSION_SEND_TO = "AW-18435275422/C3CKCJ6ri_EcEJ71z9ZE";

interface ConversionParams {
  /** The confirmed HashPay application ID — used as the transaction_id to prevent duplicate counting. */
  applicationId?: string;
  /** The actual KES amount paid (e.g. 500). Enables value-based bidding in Google Ads. */
  value?: number;
  /** Currency code — always "KES" for Kenyan Shillings. */
  currency?: string;
}

/**
 * Fire GTM dataLayer events once per confirmed payment.
 * Called only from the Confirmation page, after HashPay confirms payment.
 * GTM container (GTM-W8CBN54F) listens to these events to fire Google Ads conversions.
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

  // Robust numeric conversion for value — ensures it's never 0 or NaN if a fee is expected
  const numericValue = typeof value === "number" && !isNaN(value) && value > 0 
    ? value 
    : (Number(value) > 0 ? Number(value) : 150);

  // Debug log requested to inspect exactly what value is passed at execution time
  console.log("[Conversion Tracking] applicationId:", applicationId, "processingFee (value):", numericValue, "raw:", value);

  // Google Tag Manager / GTM Custom Events (Pushes to dataLayer)
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "lead_form_submitted",
    conversion_type: "payment_success",
    transaction_id: applicationId || `ORDER_${Date.now()}`,
    value: numericValue,
    conversion_value: numericValue,
    price: numericValue,
    amount: numericValue,
    fee: numericValue,
    transaction_total: numericValue,
    currency: currency,
    supermarket_application_id: applicationId,
  });

  window.dataLayer.push({
    event: "payment_success",
    transaction_id: applicationId || `ORDER_${Date.now()}`,
    value: numericValue,
    conversion_value: numericValue,
    price: numericValue,
    amount: numericValue,
    currency: currency,
  });

  // Standard ecommerce purchase format
  window.dataLayer.push({
    event: "purchase",
    ecommerce: {
      transaction_id: applicationId || `ORDER_${Date.now()}`,
      value: numericValue,
      currency: currency,
      items: [
        {
          item_id: applicationId || "supermarket_app",
          item_name: "Supermarket Application Processing Fee",
          price: numericValue,
          quantity: 1,
        },
      ],
    },
  });

  // Direct gtag conversion call (so direct gtag.js conversion endpoint receives the exact numericValue)
  try {
    if (typeof window.gtag !== "function") {
      window.gtag = function () {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer.push(arguments);
      };
    }
    window.gtag("event", "conversion", {
      send_to: GOOGLE_ADS_CONVERSION_SEND_TO,
      value: numericValue,
      currency: currency,
      transaction_id: applicationId || `ORDER_${Date.now()}`,
    });
  } catch (gtagErr) {
    console.warn("[Conversion Tracking] gtag call warning:", gtagErr);
  }
}
