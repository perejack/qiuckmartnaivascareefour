import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Download, Search, ChevronLeft, ChevronRight,
  RefreshCw, Calendar, Phone, Briefcase, MapPin,
  Clock, CheckCircle2, Filter, X,
  ArrowUpDown, FileText, Sheet,
} from "lucide-react";

export const Route = createFileRoute("/filament/")({
  component: AdminDashboard,
});

// Hardcoded Supabase credentials
const SUPABASE_URL = "https://dyuafiidztsjnwqubqpd.supabase.co";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5dWFmaWlkenRzam53cXVicXBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDEyMjY3NywiZXhwIjoyMTA1Njk4Njc3fQ.q5p27DM_2zmbwW2X4M4ONTEL3V8x8IZovOhashyyums";

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const PAGE_SIZE = 20;

function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("en-KE", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  } catch { return d; }
}

function sortApplicants(list) {
  const now = new Date();
  const withDate = list.filter((a) => a.interview_date);
  const noDate = list.filter((a) => !a.interview_date);
  const upcoming = withDate
    .filter((a) => new Date(a.interview_date + "T23:59:59") >= now)
    .sort((a, b) => new Date(a.interview_date).getTime() - new Date(b.interview_date).getTime());
  const past = withDate
    .filter((a) => new Date(a.interview_date + "T23:59:59") < now)
    .sort((a, b) => new Date(b.interview_date).getTime() - new Date(a.interview_date).getTime());
  return [...upcoming, ...past, ...noDate];
}

function exportCSV(data) {
  const headers = [
    "Application ID","Full Name","Phone","WhatsApp","Email","Location",
    "Supermarket","Position","Interview Date","Interview Time",
    "Work Type","Interview Mode","Employment Type","Salary Range",
    "Education","Experience","Payment Status","Processing Fee (KES)","Created At",
  ];
  const rows = data.map((a) =>
    [a.application_id,a.full_name,a.phone,a.whatsapp_number,a.email,a.location,
     a.supermarket,a.position,a.interview_date,a.interview_time,a.work_type,
     a.interview_mode,a.employment_type,a.salary_range,a.education_level,
     a.experience_level,a.payment_status,a.processing_fee,a.created_at]
    .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
  );
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `applicants_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportPDF(data) {
  const { jsPDF } = await import("jspdf/dist/jspdf.es.min.js");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 50, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Paid Applicants Dashboard", margin, 32);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString("en-KE")}  |  Total: ${data.length}`, pageW - margin - 240, 32);
  const colWidths = [100, 85, 90, 80, 70, 85, 70, 60];
  const colLabels = ["Name","Phone","Position","Interview Date","Interview Time","Supermarket","Payment","Fee (KES)"];
  let y = 70;
  const drawRow = (row, isHeader, rowIdx) => {
    if (y > pageH - 60) { doc.addPage(); y = margin; }
    const rowH = 22;
    if (isHeader) {
      doc.setFillColor(30, 41, 59);
      doc.rect(margin, y - 14, pageW - margin * 2, rowH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
    } else {
      if (rowIdx % 2 === 0) { doc.setFillColor(241, 245, 249); doc.rect(margin, y - 14, pageW - margin * 2, rowH, "F"); }
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
    }
    let x = margin + 4;
    row.forEach((cell, i) => {
      const clipped = doc.splitTextToSize(String(cell ?? "—"), colWidths[i] - 6)[0];
      doc.text(clipped, x, y);
      x += colWidths[i];
    });
    y += rowH;
  };
  drawRow(colLabels, true, -1);
  data.forEach((a, i) => drawRow([
    a.full_name ?? "—", a.phone ?? "—", a.position ?? "—",
    a.interview_date ? formatDate(a.interview_date) : "—",
    a.interview_time ?? "—", a.supermarket ?? "—",
    a.payment_status ?? "—", String(a.processing_fee ?? "—"),
  ], false, i));
  doc.save(`applicants_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function AdminDashboard() {
  const [applicants, setApplicants] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterSupermarket, setFilterSupermarket] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [supermarkets, setSupermarkets] = useState([]);
  const [positions, setPositions] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setDebouncedSearch(search), 380);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterSupermarket, filterPosition]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      let q = adminClient.from("applications").select("*", { count: "exact" })
        .eq("payment_status", "completed")
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      if (debouncedSearch.trim()) {
        const s = `%${debouncedSearch.trim()}%`;
        q = q.or(`full_name.ilike.${s},phone.ilike.${s},email.ilike.${s},application_id.ilike.${s},position.ilike.${s}`);
      }
      if (filterSupermarket) q = q.eq("supermarket", filterSupermarket);
      if (filterPosition) q = q.ilike("position", `%${filterPosition}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      setApplicants(sortApplicants(data ?? []));
      setTotalCount(count ?? 0);
      const { data: allData } = await adminClient.from("applications").select("supermarket, position").eq("payment_status", "completed");
      if (allData) {
        setSupermarkets([...new Set(allData.map((r) => r.supermarket).filter(Boolean))].sort());
        setPositions([...new Set(allData.map((r) => r.position).filter(Boolean))].sort());
      }
    } catch (err) { console.error("Admin fetch error:", err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [page, debouncedSearch, filterSupermarket, filterPosition]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = applicants.filter((a) => a.interview_date === todayStr).length;
  const upcomingCount = applicants.filter((a) => a.interview_date && a.interview_date >= todayStr).length;

  const fetchAllForExport = async () => {
    const { data, error } = await adminClient.from("applications").select("*").eq("payment_status", "completed");
    if (error) throw error;
    return sortApplicants(data ?? []);
  };

  const handleCSV = async () => {
    setExportingCSV(true);
    try { exportCSV(await fetchAllForExport()); }
    catch (e) { alert("Export failed: " + String(e)); }
    finally { setExportingCSV(false); }
  };

  const handlePDF = async () => {
    setExportingPDF(true);
    try { await exportPDF(await fetchAllForExport()); }
    catch (e) { alert("Export failed: " + String(e)); }
    finally { setExportingPDF(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex items-center h-16 gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-extrabold text-white text-sm leading-none">Filament Admin</p>
              <p className="text-xs text-slate-400 mt-0.5">Applicants Dashboard</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => void fetchData(true)} disabled={refreshing}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 bg-slate-800/60 hover:bg-slate-800 transition-all">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={handleCSV} disabled={exportingCSV}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-300 hover:text-white border border-emerald-700 hover:border-emerald-500 bg-emerald-900/40 hover:bg-emerald-800/60 transition-all">
              <Sheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{exportingCSV ? "Exporting…" : "CSV"}</span>
            </button>
            <button onClick={handlePDF} disabled={exportingPDF}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-300 hover:text-white border border-rose-700 hover:border-rose-500 bg-rose-900/40 hover:bg-rose-800/60 transition-all">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{exportingPDF ? "Exporting…" : "PDF"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Paid", value: totalCount, icon: Users, color: "from-cyan-500 to-blue-600" },
            { label: "Today's Interviews", value: todayCount, icon: Calendar, color: "from-emerald-500 to-teal-600" },
            { label: "Upcoming Interviews", value: upcomingCount, icon: Clock, color: "from-violet-500 to-purple-600" },
            { label: "Supermarkets", value: supermarkets.length, icon: Briefcase, color: "from-amber-500 to-orange-600" },
          ].map((stat) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-2 backdrop-blur-sm">
              <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <p className="text-2xl font-extrabold text-white">{loading ? "…" : stat.value}</p>
              <p className="text-xs text-slate-400">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, email, ID, position…"
                className="w-full rounded-xl bg-slate-800 border border-slate-700 focus:border-cyan-500 text-white placeholder:text-slate-500 pl-10 pr-4 py-2.5 text-sm outline-none transition-colors" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border transition-all ${showFilters ? "border-cyan-500 bg-cyan-900/30 text-cyan-300" : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"}`}>
              <Filter className="h-4 w-4" />Filters
              {(filterSupermarket || filterPosition) && (
                <span className="ml-1 h-5 w-5 rounded-full bg-cyan-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {[filterSupermarket, filterPosition].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Supermarket</label>
                    <select value={filterSupermarket} onChange={(e) => setFilterSupermarket(e.target.value)}
                      className="w-full rounded-xl bg-slate-800 border border-slate-700 focus:border-cyan-500 text-white px-3 py-2.5 text-sm outline-none">
                      <option value="">All Supermarkets</option>
                      {supermarkets.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Position</label>
                    <select value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)}
                      className="w-full rounded-xl bg-slate-800 border border-slate-700 focus:border-cyan-500 text-white px-3 py-2.5 text-sm outline-none">
                      <option value="">All Positions</option>
                      {positions.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                {(filterSupermarket || filterPosition) && (
                  <button onClick={() => { setFilterSupermarket(""); setFilterPosition(""); }}
                    className="mt-2 text-xs text-rose-400 hover:text-rose-300 underline underline-offset-2">Clear filters</button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="h-10 w-10 rounded-full border-4 border-cyan-500/30 border-t-cyan-400 animate-spin" />
            <p className="text-slate-400 text-sm">Loading applicants…</p>
          </div>
        ) : applicants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Users className="h-12 w-12 text-slate-600" />
            <p className="text-slate-400 font-semibold">No paid applicants found</p>
            <p className="text-slate-500 text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block rounded-2xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/80">
                      {["#","Name & Contact","Position & Supermarket","Interview","Location","Status","Fee"].map((h) => (
                        <th key={h} className="text-left px-4 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {applicants.map((a, idx) => {
                      const isToday = a.interview_date === todayStr;
                      const isSoon = a.interview_date && a.interview_date > todayStr && new Date(a.interview_date).getTime() - Date.now() < 3 * 86400000;
                      return (
                        <motion.tr key={a.id ?? a.application_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }}
                          className={`border-t border-slate-800/60 transition-colors hover:bg-slate-800/40 ${isToday ? "bg-emerald-950/20" : ""}`}>
                          <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-white">{a.full_name ?? "—"}</p>
                            <a href={`tel:${a.phone}`} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 mt-0.5">
                              <Phone className="h-3 w-3" />{a.phone ?? "—"}
                            </a>
                            {a.email && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]">{a.email}</p>}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-white">{a.position ?? "—"}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{a.supermarket ?? "—"}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col gap-1">
                              {a.interview_date ? (
                                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg w-fit ${isToday ? "bg-emerald-500/20 text-emerald-300 border border-emerald-700" : isSoon ? "bg-amber-500/20 text-amber-300 border border-amber-700" : "bg-slate-700 text-slate-300"}`}>
                                  <Calendar className="h-3 w-3" />{formatDate(a.interview_date)}{isToday ? " 🔴 TODAY" : ""}
                                </span>
                              ) : <span className="text-slate-500 text-xs">No date set</span>}
                              {a.interview_time && <span className="flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3 w-3" />{a.interview_time}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {a.location ? <span className="flex items-center gap-1 text-xs text-slate-300"><MapPin className="h-3 w-3 text-slate-500 shrink-0" />{a.location}</span> : <span className="text-slate-500 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />PAID
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-bold text-emerald-300 text-sm">KES {a.processing_fee ?? "—"}</td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:hidden space-y-3">
              {applicants.map((a, idx) => {
                const isToday = a.interview_date === todayStr;
                const isSoon = a.interview_date && a.interview_date > todayStr && new Date(a.interview_date).getTime() - Date.now() < 3 * 86400000;
                return (
                  <motion.div key={a.id ?? a.application_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                    className={`rounded-2xl border p-4 space-y-3 ${isToday ? "border-emerald-700 bg-emerald-950/30" : isSoon ? "border-amber-700/50 bg-amber-950/20" : "border-slate-800 bg-slate-900/60"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-extrabold text-white text-base">{a.full_name ?? "—"}</p>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">{a.application_id}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-800 shrink-0">
                        <CheckCircle2 className="h-3 w-3" />PAID
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><p className="text-slate-500 mb-0.5">Position</p><p className="text-white font-semibold">{a.position ?? "—"}</p></div>
                      <div><p className="text-slate-500 mb-0.5">Supermarket</p><p className="text-white font-semibold">{a.supermarket ?? "—"}</p></div>
                      <div><p className="text-slate-500 mb-0.5">Phone</p><a href={`tel:${a.phone}`} className="text-cyan-400 font-semibold">{a.phone ?? "—"}</a></div>
                      <div><p className="text-slate-500 mb-0.5">Fee</p><p className="text-emerald-300 font-bold">KES {a.processing_fee ?? "—"}</p></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {a.interview_date && (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg ${isToday ? "bg-emerald-500/20 text-emerald-300 border border-emerald-700" : isSoon ? "bg-amber-500/20 text-amber-300 border border-amber-700" : "bg-slate-700 text-slate-300"}`}>
                          <Calendar className="h-3 w-3" />{formatDate(a.interview_date)}{isToday ? " 🔴 TODAY" : ""}
                        </span>
                      )}
                      {a.interview_time && <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-800 px-2.5 py-1.5 rounded-lg"><Clock className="h-3 w-3" />{a.interview_time}</span>}
                      {a.location && <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-800 px-2.5 py-1.5 rounded-lg"><MapPin className="h-3 w-3" />{a.location}</span>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 py-2">
            <p className="text-xs text-slate-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of <span className="font-bold text-white">{totalCount}</span>
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:border-cyan-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pn;
                if (totalPages <= 5) pn = i + 1;
                else if (page <= 3) pn = i + 1;
                else if (page >= totalPages - 2) pn = totalPages - 4 + i;
                else pn = page - 2 + i;
                return (
                  <button key={pn} onClick={() => setPage(pn)}
                    className={`h-9 w-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${page === pn ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg" : "border border-slate-700 bg-slate-800 text-slate-300 hover:border-cyan-500 hover:text-white"}`}>
                    {pn}
                  </button>
                );
              })}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:border-cyan-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 py-4 border-t border-slate-800 text-xs text-slate-500">
          <p>Filament Admin · Supermarket Careers</p>
          <p>Sorted: nearest interview first</p>
        </div>
      </main>
    </div>
  );
}
