export type CertificateData = {
  formCode: string;
  organisation: string;
  directorate: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  refNo: string;
  issueDate: string;
  title: string;
  preamble: string;
  holderName: string;
  idNumber: string;
  body: string;
  remarksHeading: string;
  offences: string;
  resultsOfTrial: string;
  recordDate: string;
  declaration: string;
  signatoryName: string;
  signatoryTitle: string;
  signatureText: string;
  noteText: string;
};

export const defaultCertificate: CertificateData = {
  formCode: "C. 24A",
  organisation: "NATIONAL POLICE SERVICE",
  directorate: "DIRECTORATE OF CRIMINAL INVESTIGATIONS",
  addressLine1: "DIRECTORATE OF CRIMINAL INVESTIGATIONS HEADQUARTERS",
  addressLine2: "P.O.Box 30036-00100 GPO",
  addressLine3: "NAIROBI, KENYA",
  refNo: "PCC-8JTZDK53",
  issueDate: "5 January 2024",
  title: "POLICE CLEARANCE CERTIFICATE",
  preamble: "I hereby certify that the fingerprints recorded from",
  holderName: "CECILIA WANJIRU WAKARUGI",
  idNumber: "33439482",
  body: "have been searched in Criminal Records Office's database with/without previous record. The validity of the information on this certificate is as of the date of issue.",
  remarksHeading: "REMARKS IN CASE OF PREVIOUS RECORD",
  offences: "NIL",
  resultsOfTrial: "NIL",
  recordDate: "NIL",
  declaration: "This Certificate has been issued without any alteration or any erasure",
  signatoryName: "(W.N KIRAI)",
  signatoryTitle: "For: Director, Directorate of Criminal Investigations",
  signatureText: "Kirai",
  noteText:
    "NOTE: This is a computer generated certificate, to verify the authenticity of this document, use the link https://dci.evittren.go.ke/verify; send DCI to 21546 Than Dial *512# and select \"Police Clearance\"",
};

export function randomRef() {
  const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return `PCC-${out}`;
}

export function todayLong() {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function safeFileName(name: string) {
  return (
    name
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "certificate"
  );
}
