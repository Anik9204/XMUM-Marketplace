import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ListingReport, ReportStatus } from "../lib/types";
import { ExternalLink, Trash2, CheckCircle, XCircle } from "lucide-react";

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending:   "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  reviewed:  "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  dismissed: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
  actioned:  "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
};

const MAIN_APP_URL = "https://your-main-app.vercel.app";

export default function ReportsPage() {
  const { adminUser, isAdmin } = useAuth();
  const [reports, setReports] = useState<ListingReport[]>([]);
  const [filter, setFilter] = useState<ReportStatus | "all">("pending");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "reports"), orderBy("createdAt", "desc"))
      );
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as ListingReport)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: ReportStatus) {
    await Promise.race([
      updateDoc(doc(db, "reports", id), {
        status,
        reviewedBy: adminUser?.uid,
        reviewedAt: Date.now(),
      }),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 6000)),
    ]);
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  async function deleteReport(id: string) {
    if (!isAdmin) return;
    await deleteDoc(doc(db, "reports", id));
    setReports(prev => prev.filter(r => r.id !== id));
  }

  const filtered = filter === "all" ? reports : reports.filter(r => r.status === filter);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">Reports</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          User-submitted listing reports
        </p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {(["all", "pending", "reviewed", "actioned", "dismissed"] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium min-h-[40px]
                              transition-colors capitalize
                              ${filter === s
                                ? "bg-blue-600 text-white"
                                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700"}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl h-24
                                    animate-pulse border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <span className="text-5xl mb-3">🎉</span>
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            No {filter !== "all" ? filter : ""} reports
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(report => (
            <div key={report.id}
                 className="bg-white dark:bg-slate-800 rounded-2xl p-5 border
                            border-gray-100 dark:border-slate-700">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide
                                      px-2 py-0.5 rounded-full ${STATUS_COLORS[report.status]}`}>
                      {report.status}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {report.category.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {report.listingTitle}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Reported by: {report.reportedByEmail}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Seller: {report.listingUserEmail}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-2
                                bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2">
                    "{report.reason}"
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(report.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <a href={`${MAIN_APP_URL}/listing/${report.listingId}`}
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1.5 text-xs text-blue-600
                                dark:text-blue-400 border border-blue-200 dark:border-blue-800
                                rounded-xl px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20
                                min-h-[36px]">
                    <ExternalLink className="w-3 h-3" /> View Listing
                  </a>
                  {report.status === "pending" && (
                    <>
                      <button onClick={() => updateStatus(report.id, "actioned")}
                              className="flex items-center gap-1.5 text-xs text-green-600
                                         border border-green-200 rounded-xl px-3 py-2
                                         hover:bg-green-50 dark:hover:bg-green-900/20 min-h-[36px]">
                        <CheckCircle className="w-3 h-3" /> Action
                      </button>
                      <button onClick={() => updateStatus(report.id, "dismissed")}
                              className="flex items-center gap-1.5 text-xs text-slate-500
                                         border border-gray-200 dark:border-slate-600
                                         rounded-xl px-3 py-2 hover:bg-slate-50
                                         dark:hover:bg-slate-700/50 min-h-[36px]">
                        <XCircle className="w-3 h-3" /> Dismiss
                      </button>
                    </>
                  )}
                  {isAdmin && (
                    <button onClick={() => deleteReport(report.id)}
                            className="flex items-center gap-1.5 text-xs text-red-500
                                       border border-red-200 rounded-xl px-3 py-2
                                       hover:bg-red-50 dark:hover:bg-red-900/20 min-h-[36px]">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
