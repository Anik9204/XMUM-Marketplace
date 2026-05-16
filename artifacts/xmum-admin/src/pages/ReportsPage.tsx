import { useEffect, useState } from "react";
import { collection, query, orderBy, updateDoc, doc, deleteDoc, addDoc, onSnapshot, getDoc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage, writeAuditLog } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ListingReport, ReportStatus } from "../lib/types";
import { ExternalLink, Trash2, CheckCircle, XCircle, X } from "lucide-react";

// Helper: lift report hold on a regular listing
async function liftHoldOnListing(listingId: string): Promise<void> {
  try {
    await updateDoc(doc(db, "listings", listingId), {
      isReportHeld: false,
      reportHeldAt: null,
      isArchived: false,
    });
  } catch (e) {
    console.warn("[ReportsPage] liftHoldOnListing skipped:", e);
  }
}

// Helper: lift report hold on a shop listing
async function liftHoldOnShopListing(listingId: string): Promise<void> {
  try {
    await updateDoc(doc(db, "shopListings", listingId), {
      isReportHeld: false,
      reportHeldAt: null,
      isActive: true,
    });
  } catch (e) {
    console.warn("[ReportsPage] liftHoldOnShopListing skipped:", e);
  }
}

// Helper: extract Firebase Storage path from a download URL
function storagePathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const encoded = u.pathname.split("/o/")[1];
    if (!encoded) return null;
    return decodeURIComponent(encoded.split("?")[0]);
  } catch {
    return null;
  }
}

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending:   "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  reviewed:  "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  dismissed: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
  actioned:  "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
};

const MAIN_APP_URL = import.meta.env.VITE_MAIN_APP_URL ?? "";

export default function ReportsPage() {
  const { adminUser, isAdmin } = useAuth();
  const [reports, setReports] = useState<ListingReport[]>([]);
  const [filter, setFilter] = useState<ReportStatus | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ListingReport | null>(null);

  useEffect(() => {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as ListingReport)));
      setLoading(false);
    }, (err) => {
      console.error("[ReportsPage] onSnapshot error:", err);
      alert("Failed to load reports. Check the console for details.");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function updateStatus(id: string, status: ReportStatus, report?: ListingReport) {
    try {
      await Promise.race([
        updateDoc(doc(db, "reports", id), {
          status,
          reviewedBy: adminUser?.uid,
          reviewedAt: Date.now(),
        }),
        new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 6000)),
      ]);
      if (selectedReport?.id === id) {
        setSelectedReport(prev => prev ? { ...prev, status } : null);
      }
      void writeAuditLog({
        actorUid:    adminUser?.uid   ?? "",
        actorEmail:  adminUser?.email ?? "",
        action:      `report_${status}`,
        label:       `Report ${status}: "${report?.listingTitle ?? id}"`,
        targetId:    id,
        targetType:  "report",
        targetLabel: report?.listingTitle ?? id,
        createdAt:   Date.now(),
      });
      // Lift the report hold when admin dismisses the report
      if (status === "dismissed" && report) {
        const isShopListing = !!(report as any).shopId;
        if (isShopListing) {
          await liftHoldOnShopListing(report.listingId);
        } else {
          await liftHoldOnListing(report.listingId);
        }
      }
    } catch (e) {
      console.error("[ReportsPage] updateStatus failed:", e);
      alert("Failed to update status. Check the console.");
    }
  }

  async function handleActionAndDelete(report: ListingReport) {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `This will permanently delete the listing "${report.listingTitle}" and remove this report. Continue?`
    );
    if (!confirmed) return;
    try {
      // Delete Storage photos first to preserve evidence cleanup
      const listingSnap = await getDoc(doc(db, "listings", report.listingId));
      if (listingSnap.exists()) {
        const photos: string[] = listingSnap.data().photos ?? [];
        await Promise.allSettled(
          photos.map((url) => {
            const path = storagePathFromUrl(url);
            if (!path) return Promise.resolve();
            return deleteObject(ref(storage, path)).catch((err) => {
              if (err?.code !== "storage/object-not-found") console.warn("[ReportsPage] photo delete warn:", err);
            });
          })
        );
      }
      await deleteDoc(doc(db, "listings", report.listingId));
      await deleteDoc(doc(db, "reports", report.id));
      await addDoc(collection(db, `users/${report.listingUserId}/notifications`), {
        type: "listing_removed",
        title: "Listing removed",
        body: `Your listing "${report.listingTitle}" was removed by an admin due to a policy violation.`,
        createdAt: Date.now(),
        read: false,
      });
      void writeAuditLog({
        actorUid:    adminUser?.uid   ?? "",
        actorEmail:  adminUser?.email ?? "",
        action:      "listing_deleted_via_report",
        label:       `Deleted listing "${report.listingTitle}" (report actioned)`,
        targetId:    report.listingId,
        targetType:  "listing",
        targetLabel: report.listingTitle,
        createdAt:   Date.now(),
      });
      if (selectedReport?.id === report.id) setSelectedReport(null);
    } catch (e) {
      console.error("[ReportsPage] delete failed:", e);
      alert("Failed to delete listing/report. Check Firestore permissions.");
    }
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
            {s !== "all" && (
              <span className="ml-1.5 text-[10px] opacity-70">
                ({reports.filter(r => r.status === s).length})
              </span>
            )}
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
                 onClick={() => setSelectedReport(report)}
                 className="bg-white dark:bg-slate-800 rounded-2xl p-5 border
                            border-gray-100 dark:border-slate-700 cursor-pointer
                            hover:border-blue-200 dark:hover:border-blue-700
                            hover:shadow-sm transition-all">
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
                                bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2 line-clamp-2">
                    "{report.reason}"
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(report.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0"
                     onClick={e => e.stopPropagation()}>
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
                      <button onClick={() => updateStatus(report.id, "dismissed", report)}
                              className="flex items-center gap-1.5 text-xs text-slate-500
                                         border border-gray-200 dark:border-slate-600
                                         rounded-xl px-3 py-2 hover:bg-slate-50
                                         dark:hover:bg-slate-700/50 min-h-[36px]">
                        <XCircle className="w-3 h-3" /> Dismiss
                      </button>
                    </>
                  )}
                  {isAdmin && (
                    <button onClick={() => handleActionAndDelete(report)}
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

      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
             onClick={() => setSelectedReport(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg
                          max-h-[90vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b
                            border-gray-100 dark:border-slate-700 sticky top-0
                            bg-white dark:bg-slate-800 z-10">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5
                                  rounded-full ${STATUS_COLORS[selectedReport.status]}`}>
                  {selectedReport.status}
                </span>
                <span className="text-xs text-slate-400 capitalize">
                  {selectedReport.category.replace("_", " ")}
                </span>
              </div>
              <button onClick={() => setSelectedReport(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
                                 min-h-[44px] flex items-center justify-center w-8">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                  Listing
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {selectedReport.listingTitle}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  ID: {selectedReport.listingId}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                    Reporter
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 break-all">
                    {selectedReport.reportedByEmail}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                    Seller
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 break-all">
                    {selectedReport.listingUserEmail}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                  Reason
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50
                              dark:bg-slate-700/50 rounded-xl px-4 py-3 leading-relaxed">
                  "{selectedReport.reason}"
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                    Submitted
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {new Date(selectedReport.createdAt).toLocaleString()}
                  </p>
                </div>
                {selectedReport.reviewedAt && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                      Reviewed
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {new Date(selectedReport.reviewedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                <a href={`${MAIN_APP_URL}/listing/${selectedReport.listingId}`}
                   target="_blank" rel="noopener noreferrer"
                   className="flex items-center justify-center gap-1.5 text-sm text-blue-600
                              dark:text-blue-400 border border-blue-200 dark:border-blue-800
                              rounded-xl px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20
                              min-h-[44px] transition-colors">
                  <ExternalLink className="w-4 h-4" /> View Listing in Marketplace
                </a>
                {selectedReport.status === "pending" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => updateStatus(selectedReport.id, "actioned")}
                            className="flex items-center justify-center gap-1.5 text-sm text-green-600
                                       border border-green-200 rounded-xl px-4 py-2.5
                                       hover:bg-green-50 dark:hover:bg-green-900/20 min-h-[44px]">
                      <CheckCircle className="w-4 h-4" /> Mark Actioned
                    </button>
                    <button onClick={() => updateStatus(selectedReport.id, "dismissed", selectedReport)}
                            className="flex items-center justify-center gap-1.5 text-sm text-slate-500
                                       border border-gray-200 dark:border-slate-600 rounded-xl px-4
                                       py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 min-h-[44px]">
                      <XCircle className="w-4 h-4" /> Dismiss
                    </button>
                  </div>
                )}
                {isAdmin && (
                  <button onClick={() => handleActionAndDelete(selectedReport)}
                          className="flex items-center justify-center gap-1.5 text-sm text-red-500
                                     border border-red-200 rounded-xl px-4 py-2.5
                                     hover:bg-red-50 dark:hover:bg-red-900/20 min-h-[44px]">
                    <Trash2 className="w-4 h-4" /> Delete Listing & Report
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
