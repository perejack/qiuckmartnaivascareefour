import { toast } from "sonner";

// HashBack (HashPay) M-Pesa Integration Service
export class MpesaService {
  static formatPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) cleaned = "254" + cleaned.substring(1);
    if (cleaned.startsWith("+")) cleaned = cleaned.substring(1);
    if (!cleaned.startsWith("254")) cleaned = "254" + cleaned;
    return cleaned;
  }

  static async initiateSTKPush(
    phoneNumber: string,
    amount: number,
    applicationId: string,
    _userId: string,
    _supermarket: string,
  ): Promise<{ success: boolean; checkoutRequestId?: string; error?: string }> {
    try {
      const response = await fetch("/api/hashback/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phoneNumber,
          phoneNumber,
          amount: Math.round(Number(amount)),
          description: "food order",
          reference: applicationId || `GROUPSUPER-${Date.now()}`,
          referencePrefix: "GROUPSUPER",
        }),
      });

      const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok || !data || data.success === false) {
        console.error("HashBack payment initiation failed:", data);
        return {
          success: false,
          error:
            (typeof data?.message === "string" ? data.message : null) ??
            "Failed to initiate payment",
        };
      }

      const checkoutId =
        (typeof data.checkoutId === "string" ? data.checkoutId : null) ??
        (typeof data.checkoutRequestId === "string" ? data.checkoutRequestId : null);

      if (!checkoutId) {
        return { success: false, error: "Payment initiated but missing checkoutId" };
      }

      toast.success("STK Push sent! Check your phone and enter PIN.");

      return {
        success: true,
        checkoutRequestId: checkoutId,
      };
    } catch (error: unknown) {
      console.error("HashBack STK Push Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to initiate payment",
      };
    }
  }

  static async getPaymentStatus(
    checkoutRequestId: string,
  ): Promise<"completed" | "failed" | "pending"> {
    const response = await fetch("/api/hashback/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutId: checkoutRequestId }),
    });

    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok || !data || data.status === "error") {
      throw new Error(
        (typeof data?.message === "string" ? data.message : null) ?? "Status check failed",
      );
    }

    const status = String(data.status ?? data.state ?? "").toLowerCase();
    const rawStatus = String(data.rawStatus ?? "").toLowerCase();

    if (
      status === "paid" ||
      status === "success" ||
      rawStatus === "completed" ||
      rawStatus === "success" ||
      rawStatus === "paid"
    ) {
      return "completed";
    }

    if (
      status === "failed" ||
      rawStatus === "failed" ||
      rawStatus === "cancelled" ||
      rawStatus === "canceled"
    ) {
      return "failed";
    }

    return "pending";
  }
}

