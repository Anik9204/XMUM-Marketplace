import { useEffect, useState } from "react";
import {
  collection, query, orderBy, limit, onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { AuditEntry } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ShieldAlert, Download } from "lucide-react";
import { exportToCsv } from "../lib/exportCsv";

type AuditDoc = AuditEntry & { id: string };

const ACTION_COLORS: Record<string, string> = {
  listing_deleted:              "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  listing_deleted_via_report:   "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  listing_archived:             "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  listing_featured:             "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  report_dismissed:             "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
  report_reviewed:              "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  report_actioned:              "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  shop_deleted:                 "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  shop_suspended:               "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  shop_unsuspended:             "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  user_banned:                  "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  user_unbanned:                "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  user_role_changed:            "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
};

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const { isAdmin } = useAuth();
  const [logs, setLogs]         = useState<AuditDoc[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState<AuditEntry["targetType"] | "all">("all");

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }

    const q = query(
      collection(db, "adminAuditLogs"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditDoc)));
        setLoading(false);
      },
      (err) => {
        console.error("[AuditLogPage] onSnapshot error:", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [isAdmin]);

  const filtered = logs.filter((log) => {
    const matchesType   = typeFilter === "all" || log.targetType === typeFilter;
    const matchesSearch = !search.trim() ||
      log.label.toLowerCase().includes(search.toLowerCase()) ||
      log.actorEmail.toLowerCase().includes(search.toLowerCase()) ||
      log.targetLabel.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  function handleExport() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const headers = [
      "Log ID", "Actor Email", "Actor UID",
      "Action", "Description", "Target Type",
      "Target ID", "Target Label", "Date",
    ];
    const rows = filtered.map((log) => [
      log.id,
      log.actorEmail,
      log.actorUid,
      log.action,
      log.label,
      log.targetType,
      log.targetId,
      log.targetLabel,
      new Date(log.createdAt).toLocaleString("en-MY", {
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      }),
    ]);
    exportToCsv(`audit_log_${timestamp}.csv`, headers, rows);
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <ShieldAlert className="w-12 h-12 text-red-400 mb-4" />
        <p className="font-semibold text-slate-700 dark:text-slate-300 text-lg">
          Access Restricted
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          The audit log is only visible to admin-role users.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-slate-400" />
            Admin Audit Log
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Tamper-evident record of all admin actions — last {PAGE_SIZE} entries
          </p>
        </div>
        {!loading && (
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 text-sm font-medium text-slate-600
                       dark:text-slate-300 border border-gray-200 dark:border-slate-700
                       bg-white dark:bg-slate-800 rounded-xl px-4 min-h-[40px]
                       hover:bg-slate-50 dark:hover:bg-slate-700/50
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search actions, emails, targets…"
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                     rounded-xl px-3 py-2.5 text-sm min-h-[44px] flex-1 min-w-[220px]
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     text-slate-700 dark:text-slate-300"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                     rounded-xl px-3 py-2.5 text-sm min-h-[44px]
                     focus:outline-none focus:ring-2 focus:ring-blue-500
                     text-slate-700 dark:text-slate-300"
        >
          <option value="all">All Types</option>
          <option value="listing">Listings</option>
          <option value="report">Reports</option>
          <option value="shop">Shops</option>
          <option value="user">Users</option>
          <option value="shopAd">Shop Ads</option>
        </select>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i}
                 className="h-16 bg-white dark:bg-slate-800 rounded-2xl animate-pulse
                            border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <span className="text-5xl mb-3">📋</span>
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            {logs.length === 0 ? "No audit entries yet." : "No entries match your filters."}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {logs.length === 0
              ? "Admin actions will appear here once they are performed."
              : "Try clearing the search or changing the type filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((log) => (
            <div
              key={log.id}
              className="bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 border
                         border-gray-100 dark:border-slate-700 flex items-center gap-3"
            >
              {/* Action badge */}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                                flex-shrink-0 whitespace-nowrap
                                ${ACTION_COLORS[log.action] ??
                                  "bg-slate-100 dark:bg-slate-700 text-slate-500"}`}>
                {log.action.replace(/_/g, " ")}
              </span>

              {/* Label */}
              <p className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate min-w-0">
                {log.label}
              </p>

              {/* Actor + time */}
              <div className="flex-shrink-0 text-right hidden sm:block">
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                  {log.actorEmail}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {new Date(log.createdAt).toLocaleDateString("en-MY", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                  {" · "}
                  {new Date(log.createdAt).toLocaleTimeString("en-MY", {
                    hour: "2-digit", minute: "2-digit", hour12: false,
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
