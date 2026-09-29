import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CertificateDocument } from "@/components/CertificateDocument";
import {
  defaultCertificate,
  randomRef,
  safeFileName,
  todayLong,
  type CertificateData,
} from "@/lib/certificate";
import { ArrowLeft, ShieldCheck, Download, Plus, Save, Sparkles } from "lucide-react";

type CertificateSearch = {
  name?: string;
  id?: string;
  ref?: string;
};

export const Route = createFileRoute("/certificate/")({
  validateSearch: (search: Record<string, unknown>): CertificateSearch => ({
    name: typeof search.name === "string" ? search.name : undefined,
    id: typeof search.id === "string" ? search.id : undefined,
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  head: () => ({
    meta: [
      { title: "CertiGen — Instant Certificate Generator" },
      {
        name: "description",
        content:
          "Key in applicant details once and instantly generate a print-ready certificate you can download as PDF.",
      },
      { property: "og:title", content: "CertiGen — Instant Certificate Generator" },
      {
        property: "og:description",
        content: "Fill in applicant details, preview live, download a print-ready PDF.",
      },
    ],
  }),
  component: CertificatePage,
});

type Saved = { id: string; label: string; data: CertificateData };

const STORAGE_KEY = "certigen.records.v1";

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  const shared =
    "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30";
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {textarea ? (
        <textarea
          className={`${shared} min-h-[76px] resize-y`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input className={shared} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-foreground">{title}</h3>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function CertificatePage() {
  const search = Route.useSearch();
  const [data, setData] = useState<CertificateData>(() => {
    return {
      ...defaultCertificate,
      holderName: search.name ? search.name.toUpperCase() : defaultCertificate.holderName,
      idNumber: search.id || defaultCertificate.idNumber,
      refNo: search.ref || defaultCertificate.refNo,
    };
  });

  const [saved, setSaved] = useState<Saved[]>([]);
  const [busy, setBusy] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw) as Saved[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (search.name || search.id || search.ref) {
      setData((d) => ({
        ...d,
        ...(search.name ? { holderName: search.name.toUpperCase() } : {}),
        ...(search.id ? { idNumber: search.id } : {}),
        ...(search.ref ? { refNo: search.ref } : {}),
      }));
    }
  }, [search.name, search.id, search.ref]);

  const persist = (next: Saved[]) => {
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const set = (key: keyof CertificateData) => (v: string) =>
    setData((d) => ({ ...d, [key]: v }));

  const newApplicant = () =>
    setData((d) => ({
      ...d,
      holderName: "",
      idNumber: "",
      refNo: randomRef(),
      issueDate: todayLong(),
      offences: "NIL",
      resultsOfTrial: "NIL",
      recordDate: "NIL",
    }));

  const saveRecord = () => {
    const entry: Saved = {
      id: crypto.randomUUID(),
      label: `${data.holderName || "Unnamed"} · ${data.refNo}`,
      data,
    };
    persist([entry, ...saved].slice(0, 50));
  };

  const download = async (kind: "pdf" | "png") => {
    const node = docRef.current;
    if (!node) return;
    setBusy(true);
    try {
      const { toPng } = await import("html-to-image");
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
      const opts = {
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        width: node.offsetWidth,
        height: node.offsetHeight,
        style: { transform: "none", margin: "0" },
        cacheBust: true,
      };
      await toPng(node, opts); // warm-up pass so fonts/images embed
      const png = await toPng(node, opts);
      const base = `${safeFileName(data.holderName)}-${data.refNo}`;
      if (kind === "png") {
        const a = document.createElement("a");
        a.href = png;
        a.download = `${base}.png`;
        a.click();
      } else {
        const { jsPDF } = await import("jspdf/dist/jspdf.es.min.js");
        const pdf = new jsPDF({ unit: "px", format: [794, 1123], orientation: "portrait" });
        pdf.addImage(png, "PNG", 0, 0, 794, 1123);
        pdf.save(`${base}.pdf`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-cert-navy">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/filament"
              className="inline-flex items-center gap-1.5 rounded-md border border-cert-gold/40 px-3 py-1.5 text-xs font-semibold text-cert-gold hover:bg-cert-gold/10 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Admin
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cert-gold" />
                <h1 className="text-lg font-bold tracking-tight text-cert-gold">CertiGen</h1>
              </div>
              <p className="text-xs text-cert-paper/70">
                Key in applicant details · preview instantly · download PDF
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={newApplicant}
              className="rounded-md border border-cert-gold/50 px-4 py-2 text-sm font-semibold text-cert-gold transition hover:bg-cert-gold/10"
            >
              New applicant
            </button>
            <button
              onClick={saveRecord}
              className="rounded-md border border-cert-gold/50 px-4 py-2 text-sm font-semibold text-cert-gold transition hover:bg-cert-gold/10"
            >
              Save record
            </button>
            <button
              onClick={() => download("png")}
              disabled={busy}
              className="rounded-md border border-cert-gold/50 px-4 py-2 text-sm font-semibold text-cert-gold transition hover:bg-cert-gold/10 disabled:opacity-60"
            >
              Download Image
            </button>
            <button
              onClick={() => download("pdf")}
              disabled={busy}
              className="rounded-md bg-cert-gold px-5 py-2 text-sm font-bold text-cert-navy transition hover:opacity-90 disabled:opacity-60 shadow"
            >
              {busy ? "Generating…" : "Download PDF"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-6 px-6 py-6 lg:grid-cols-[400px_1fr]">
        <div className="grid gap-4">
          <Section title="Applicant details">
            <Field label="Full name" value={data.holderName} onChange={set("holderName")} />
            <Field label="ID number" value={data.idNumber} onChange={set("idNumber")} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ref. No." value={data.refNo} onChange={set("refNo")} />
              <Field label="Date" value={data.issueDate} onChange={set("issueDate")} />
            </div>
            <button
              onClick={() => setData((d) => ({ ...d, refNo: randomRef(), issueDate: todayLong() }))}
              className="justify-self-start text-xs font-semibold text-primary underline-offset-2 hover:underline"
            >
              Auto-fill reference &amp; today's date
            </button>
          </Section>

          <Section title="Record remarks">
            <Field label="Offence(s)" value={data.offences} onChange={set("offences")} />
            <Field
              label="Results of trial"
              value={data.resultsOfTrial}
              onChange={set("resultsOfTrial")}
            />
            <Field label="Date" value={data.recordDate} onChange={set("recordDate")} />
          </Section>

          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <button
              onClick={() => setShowTemplate((s) => !s)}
              className="flex w-full items-center justify-between text-sm font-bold text-foreground"
            >
              Template &amp; authority settings
              <span className="text-muted-foreground">{showTemplate ? "−" : "+"}</span>
            </button>
            {showTemplate && (
              <div className="mt-3 grid gap-3">
                <Field label="Form code" value={data.formCode} onChange={set("formCode")} />
                <Field
                  label="Organisation"
                  value={data.organisation}
                  onChange={set("organisation")}
                />
                <Field label="Directorate" value={data.directorate} onChange={set("directorate")} />
                <Field label="Address line 1" value={data.addressLine1} onChange={set("addressLine1")} />
                <Field label="Address line 2" value={data.addressLine2} onChange={set("addressLine2")} />
                <Field label="Address line 3" value={data.addressLine3} onChange={set("addressLine3")} />
                <Field label="Certificate title" value={data.title} onChange={set("title")} />
                <Field label="Preamble" value={data.preamble} onChange={set("preamble")} />
                <Field label="Body text" value={data.body} onChange={set("body")} textarea />
                <Field
                  label="Remarks heading"
                  value={data.remarksHeading}
                  onChange={set("remarksHeading")}
                />
                <Field label="Declaration" value={data.declaration} onChange={set("declaration")} />
                <Field
                  label="Signature text"
                  value={data.signatureText}
                  onChange={set("signatureText")}
                />
                <Field
                  label="Signatory name"
                  value={data.signatoryName}
                  onChange={set("signatoryName")}
                />
                <Field
                  label="Signatory title"
                  value={data.signatoryTitle}
                  onChange={set("signatoryTitle")}
                />
                <Field label="Footer note" value={data.noteText} onChange={set("noteText")} textarea />
              </div>
            )}
          </section>

          <Section title={`Saved records (${saved.length})`}>
            {saved.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Saved applicants appear here so you can reprint any certificate in one click.
              </p>
            )}
            <div className="grid gap-2">
              {saved.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs"
                >
                  <span className="truncate">{s.label}</span>
                  <span className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setData(s.data)}
                      className="font-semibold text-primary hover:underline"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => persist(saved.filter((x) => x.id !== s.id))}
                      className="font-semibold text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="flex justify-center">
          <div className="cert-preview overflow-hidden rounded-md shadow-2xl">
            <CertificateDocument ref={docRef} data={data} />
          </div>
        </div>
      </main>
    </div>
  );
}
