export type ConfirmationPayload = {
  supermarketSlug: string;
  applicationId: string;
  checkoutRequestId: string;
  mpesaNumber: string;
  processingFee: number;
  paymentStatus: "completed";
  selectedPosition: string;
  fullName: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  location: string;
  startTime: string;
  willingToTrain: string;
  workType: string;
  interviewMode: string;
  employmentType: string;
  salary: string;
  education: string;
  experience: string;
  /** ISO date string YYYY-MM-DD */
  interviewDate: string;
  interviewTime: string;
  contactMethod: string;
  contactValue: string;
};

const STORAGE_KEY = "gs_confirmation_payload";

export function saveConfirmationPayload(payload: ConfirmationPayload) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function loadConfirmationPayload(): ConfirmationPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConfirmationPayload;
  } catch {
    return null;
  }
}

export function clearConfirmationPayload() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
