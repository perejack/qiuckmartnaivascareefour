import { useEffect, useMemo, useState } from "react";
import {
  getEmailDomain,
  isKnownEmailProvider,
  validateEmail,
  type EmailValidationResult,
} from "@/lib/emailValidation";

type DeliverabilityStatus = "idle" | "checking" | "deliverable" | "undeliverable" | "error";

type DeliverabilityState = {
  status: DeliverabilityStatus;
  message?: string;
};

export function useEmailDeliverability(email: string, enabled = true) {
  const validation = useMemo(() => validateEmail(email), [email]);
  const domain = useMemo(() => getEmailDomain(email), [email]);
  const skipRemoteCheck = domain ? isKnownEmailProvider(domain) : false;
  const [deliverability, setDeliverability] = useState<DeliverabilityState>({ status: "idle" });

  useEffect(() => {
    if (!enabled || !validation.valid) {
      setDeliverability({ status: "idle" });
      return;
    }

    if (skipRemoteCheck) {
      setDeliverability({ status: "deliverable" });
      return;
    }

    const controller = new AbortController();
    setDeliverability({ status: "checking" });

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
          signal: controller.signal,
        });

        const data = (await response.json()) as {
          deliverable?: boolean;
          error?: string;
        };

        if (controller.signal.aborted) return;

        if (!response.ok) {
          setDeliverability({
            status: "error",
            message: data.error || "Could not verify this email right now. Please check the spelling carefully.",
          });
          return;
        }

        if (!data.deliverable) {
          setDeliverability({
            status: "undeliverable",
            message: data.error || "This email domain cannot receive mail. Please check for typos.",
          });
          return;
        }

        setDeliverability({ status: "deliverable" });
      } catch (error) {
        if (controller.signal.aborted) return;
        setDeliverability({
          status: "error",
          message: "Could not verify this email right now. Please check the spelling carefully.",
        });
      }
    }, 700);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [email, enabled, skipRemoteCheck, validation.valid]);

  const canForward =
    validation.valid &&
    (skipRemoteCheck || deliverability.status === "deliverable");

  const isChecking = deliverability.status === "checking";

  return {
    validation,
    deliverability,
    canForward,
    isChecking,
    skipRemoteCheck,
  } satisfies {
    validation: EmailValidationResult;
    deliverability: DeliverabilityState;
    canForward: boolean;
    isChecking: boolean;
    skipRemoteCheck: boolean;
  };
}
