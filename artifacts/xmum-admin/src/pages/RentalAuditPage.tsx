import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { exportToCsv } from "../lib/exportCsv";
import { FileText, Loader2, Download } from "lucide-react";

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  listingId: string;
  listingTitle: string;
  tcVersion: string;
  acceptedAt: number;
  userAgent: string;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString("en-MY", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function RentalAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchLogs() {
      try {
        const q = query(collection(db, "rentalAuditLogs"), orderBy("acceptedAt", "desc"));
        const snap = await getDocs(q);
        setLogs(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AuditLog, "id">),
          }))
        );
      } catch (err: any) {
        setError(err?.message ?? "Failed to load audit logs.");
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  const filtered = logs.filter((log) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.userEmail?.toLowerCase().includes(q) ||
      log.listingTitle?.toLowerCase().includes(q)
    );
  });

  function handleExport() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const headers = [
      "Log ID", "User UID", "User Email", "Listing ID",
      "Listing Title", "T&C Version", "Accepted At", "User Agent",
    ];
    const rows = filtered.map((log) => [
      log.id,
      log.userId,
      log.userEmail,
      log.listingId,
      log.listingTitle,
      log.tcVersion,
      new Date(log.acceptedAt).toLocaleString("en-MY", {
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      }),
      log.userAgent,
    ]);
    exportToCsv(`rental_audit_${timestamp}.csv`, headers, rows);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Rental T&amp;C Audit Log</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Permanent, tamper-proof record of Rental Disclaimer acceptances. Never deleted.
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or listing title…"
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                     rounded-xl px-3 py-2 text-sm min-h-[40px] w-56 flex-shrink-0
                     focus:outline-none focus:ring-2 focus:ring-amber-400
                     text-slate-700 dark:text-slate-300"
        />
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 text-sm font-medium text-slate-600
                     dark:text-slate-300 border border-gray-200 dark:border-slate-700
                     bg-white dark:bg-slate-800 rounded-xl px-4 min-h-[40px] flex-shrink-0
                     hover:bg-slate-50 dark:hover:bg-slate-700/50
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
        <div className="ml-auto bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium flex-shrink-0">
          {filtered.length !== logs.length
            ? `${filtered.length} of ${logs.length} record${logs.length !== 1 ? "s" : ""}`
            : `${logs.length} record${logs.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3 mb-6 text-xs text-yellow-800 dark:text-yellow-300">
        ⚠️ These records are retained for legal compliance under Malaysian law (PDPA 2010) and may be required in dispute resolution.
        Data in this collection persists even after user account or listing deletion.
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No rental T&amp;C acceptances recorded yet.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-600">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">Accepted At</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">User Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">User ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">Listing</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">Listing ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">TC Version</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">User Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono">
                      {formatDate(log.acceptedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap">
                      {log.userEmail}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                        {log.userId}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-200 max-w-[200px] truncate">
                      {log.listingTitle}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                        {log.listingId}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                        {log.tcVersion}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-400 dark:text-slate-500 max-w-[240px] truncate" title={log.userAgent}>
                      {log.userAgent}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
