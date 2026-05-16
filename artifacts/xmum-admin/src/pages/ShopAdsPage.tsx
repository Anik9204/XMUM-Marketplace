import { useEffect, useState } from "react";
import { CheckCircle, XCircle, ExternalLink, Loader2 } from "lucide-react";
import {
  subscribePendingShopAds, subscribeAllShopAds,
  approveShopAd, rejectShopAd,
  notifyShopAdApproved, notifyShopAdRejected,
} from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ShopAd, ShopAdStatus } from "../lib/types";

type Tab = "pending" | "all";

const STATUS_STYLES: Record<ShopAdStatus, string> = {
  pending:  "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  approved: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  rejected: "bg-red-100  dark:bg-red-900/30  text-red-600  dark:text-red-400",
};

export default function ShopAdsPage() {
  const { adminUser } = useAuth();
  const [tab, setTab]               = useState<Tab>("pending");
  const [pending, setPending]       = useState<ShopAd[]>([]);
  const [all, setAll]               = useState<ShopAd[]>([]);
  const [loading, setLoading]       = useState(true);
  const [acting, setActing]         = useState<string | null>(null);
  const [rejectId, setRejectId]     = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    setLoading(true);
    let pendingLoaded = false;
    let allLoaded = false;

    const checkDone = () => {
      if (pendingLoaded && allLoaded) setLoading(false);
    };

    const unsubPending = subscribePendingShopAds(
      (ads) => { setPending(ads); pendingLoaded = true; checkDone(); },
      () => { pendingLoaded = true; checkDone(); },
    );

    const unsubAll = subscribeAllShopAds(
      (ads) => { setAll(ads); allLoaded = true; checkDone(); },
      () => { allLoaded = true; checkDone(); },
    );

    return () => { unsubPending(); unsubAll(); };
  }, []);

  async function handleApprove(ad: ShopAd) {
    if (!adminUser) return;
    setActing(ad.id);
    try {
      await approveShopAd(ad.id, adminUser.email ?? "admin");
      if (ad.shopOwnerId) {
        await notifyShopAdApproved(ad.shopOwnerId, ad.shopName, ad.shopId);
      }
    } catch (e) {
      console.error("[ShopAdsPage] approve failed:", e);
      alert("Failed to approve ad.");
    } finally {
      setActing(null);
    }
  }

  function openReject(ad: ShopAd) {
    setRejectId(ad.id);
    setRejectNote("");
  }

  async function confirmReject() {
    if (!rejectId || !adminUser) return;
    setActing(rejectId);
    const adBeingRejected = [...pending, ...all].find(a => a.id === rejectId);
    try {
      await rejectShopAd(rejectId, adminUser.email ?? "admin", rejectNote.trim());
      if (adBeingRejected?.shopOwnerId) {
        await notifyShopAdRejected(
          adBeingRejected.shopOwnerId,
          adBeingRejected.shopName,
          rejectNote.trim(),
          adBeingRejected.shopId,
        );
      }
      setRejectId(null);
    } catch (e) {
      console.error("[ShopAdsPage] reject failed:", e);
      alert("Failed to reject ad.");
    } finally {
      setActing(null);
    }
  }

  const rows = tab === "pending" ? pending : all;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
          Shop Ad Submissions
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Review and approve shop ad requests
        </p>
      </div>

      <div className="flex gap-1 mb-5 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {(["pending", "all"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[36px] capitalize
              ${tab === t
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
          >
            {t === "pending" ? `Pending${pending.length > 0 ? ` (${pending.length})` : ""}` : "All Ads"}
          </button>
        ))}
      </div>

      {rejectId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-5">
            <h2 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Reject Ad
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Provide a reason for rejection (optional, visible to the shop owner):
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="e.g. Image does not meet quality standards…"
              className="w-full bg-slate-50 dark:bg-slate-700 border border-gray-200
                         dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-red-400
                         text-slate-800 dark:text-slate-200 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRejectId(null)}
                className="px-4 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400
                           border border-gray-200 dark:border-slate-700 hover:bg-slate-50
                           dark:hover:bg-slate-700 transition-colors min-h-[40px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={!!acting}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-500
                           hover:bg-red-600 disabled:opacity-50 transition-colors min-h-[40px]
                           flex items-center gap-2"
              >
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-white dark:bg-slate-800 rounded-2xl
                                    animate-pulse border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <span className="text-5xl mb-3">📢</span>
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            {tab === "pending" ? "No pending ad requests" : "No ad submissions yet"}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {tab === "pending" ? "All caught up!" : "Shop owners haven't submitted any ads yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((ad) => (
            <div key={ad.id}
                 className="bg-white dark:bg-slate-800 rounded-2xl border
                            border-gray-100 dark:border-slate-700 p-4 flex gap-4 items-start">
              {ad.imageUrl && (
                <a href={ad.imageUrl} target="_blank" rel="noopener noreferrer"
                   title="Open full image"
                   className="flex-shrink-0 group relative">
                  <img
                    src={ad.imageUrl}
                    alt={ad.shopName}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    className="w-20 h-14 rounded-xl object-cover bg-slate-100
                               group-hover:opacity-80 transition-opacity"
                  />
                  <ExternalLink className="absolute top-1 right-1 w-3 h-3 text-white
                                           opacity-0 group-hover:opacity-100 transition-opacity
                                           drop-shadow" />
                </a>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                  <div>
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                      {ad.shopName || "Unknown Shop"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {ad.tagline}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold
                                    uppercase tracking-wide flex-shrink-0
                                    ${STATUS_STYLES[ad.status] ?? ""}`}>
                    {ad.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400 mb-2">
                  <span>
                    {ad.startDate
                      ? new Date(ad.startDate).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                    {" → "}
                    {ad.endDate
                      ? new Date(ad.endDate).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                  </span>
                  {ad.pricePerDay != null && (
                    <span>RM {ad.pricePerDay}/day</span>
                  )}
                  {ad.submittedBy && (
                    <span>by {ad.submittedBy}</span>
                  )}
                  {ad.submittedAt && (
                    <span>
                      submitted {new Date(ad.submittedAt).toLocaleDateString("en-MY", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                  )}
                </div>

                {(ad.status === "approved" || ad.status === "rejected") && ad.reviewedBy && (
                  <p className="text-[11px] text-slate-400 mb-2">
                    {ad.status === "approved" ? "✅ Approved" : "❌ Rejected"} by{" "}
                    <span className="font-medium text-slate-500 dark:text-slate-300">
                      {ad.reviewedBy}
                    </span>
                    {ad.reviewedAt && (
                      <> on {new Date(ad.reviewedAt).toLocaleDateString("en-MY", {
                        day: "numeric", month: "short", year: "numeric",
                      })}</>
                    )}
                    {ad.adminNote && (
                      <> · <span className="italic">"{ad.adminNote}"</span></>
                    )}
                  </p>
                )}

                {ad.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(ad)}
                      disabled={!!acting}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-green-600
                                 border border-green-200 dark:border-green-800 rounded-xl
                                 px-3 py-1.5 hover:bg-green-50 dark:hover:bg-green-900/20
                                 transition-colors min-h-[34px] disabled:opacity-50"
                    >
                      {acting === ad.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <CheckCircle className="w-3 h-3" />}
                      Approve
                    </button>
                    <button
                      onClick={() => openReject(ad)}
                      disabled={!!acting}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-red-500
                                 border border-red-200 dark:border-red-800 rounded-xl
                                 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20
                                 transition-colors min-h-[34px] disabled:opacity-50"
                    >
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
