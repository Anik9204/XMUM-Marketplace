import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Search, ExternalLink, X } from "lucide-react";
import { getPendingShops, approveShop, rejectShop, writeAuditLog, ApprovalResult } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { AdminShop } from "../lib/types";

interface ApprovalModal {
  shopName: string;
  subscriptionType: "trial" | "active";
  expiresAt: number;
}

function fmtMY(ms: number): string {
  return new Date(ms).toLocaleDateString("en-MY", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function ShopApprovalsPage() {
  const { adminUser } = useAuth();
  const [shops, setShops] = useState<AdminShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [approvalModal, setApprovalModal] = useState<ApprovalModal | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getPendingShops(100);
      setShops(data as AdminShop[]);
    } catch (e) {
      console.error("[ShopApprovalsPage] load failed:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(shop: AdminShop) {
    if (!window.confirm(`Approve shop "${shop.shopName}"?\n\nThis will make it live on Campus Market.`)) return;
    setProcessing(shop.id);
    try {
      const result: ApprovalResult = await approveShop(shop.id, shop.ownerUid, shop.shopName, adminUser?.email ?? "");
      setShops((prev) => prev.filter((s) => s.id !== shop.id));
      setApprovalModal({
        shopName:         shop.shopName,
        subscriptionType: result.subscriptionType,
        expiresAt:        result.expiresAt,
      });
      void writeAuditLog({
        actorUid:    adminUser?.uid   ?? "",
        actorEmail:  adminUser?.email ?? "",
        action:      "shop_approved",
        label:       `Approved shop "${shop.shopName}"`,
        targetId:    shop.id,
        targetType:  "shop",
        targetLabel: shop.shopName,
        createdAt:   Date.now(),
      });
    } catch (e) {
      console.error("[ShopApprovalsPage] approve failed:", e);
      alert("Failed to approve shop. Check Firestore permissions.");
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(shop: AdminShop) {
    const reason = window.prompt(
      `Reject shop "${shop.shopName}"?\n\nOptionally enter a reason (shown to the shop owner):`,
      ""
    );
    if (reason === null) return;
    setProcessing(shop.id);
    try {
      await rejectShop(shop.id, shop.ownerUid, shop.shopName, adminUser?.email ?? "", reason || undefined);
      setShops((prev) => prev.filter((s) => s.id !== shop.id));
      void writeAuditLog({
        actorUid:    adminUser?.uid   ?? "",
        actorEmail:  adminUser?.email ?? "",
        action:      "shop_rejected",
        label:       `Rejected shop "${shop.shopName}"${reason ? `: ${reason}` : ""}`,
        targetId:    shop.id,
        targetType:  "shop",
        targetLabel: shop.shopName,
        createdAt:   Date.now(),
      });
    } catch (e) {
      console.error("[ShopApprovalsPage] reject failed:", e);
      alert("Failed to reject shop. Check Firestore permissions.");
    } finally {
      setProcessing(null);
    }
  }

  const filtered = shops.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.shopName?.toLowerCase().includes(q) || s.ownerEmail?.toLowerCase().includes(q);
  });

  return (
    <div className="p-6">
      {/* Approval result modal */}
      {approvalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Shop Approved
                </h2>
              </div>
              <button
                onClick={() => setApprovalModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200
                           rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Shop</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {approvalModal.shopName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Subscription</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${approvalModal.subscriptionType === "trial"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"}`}>
                    {approvalModal.subscriptionType === "trial" ? "Trial" : "Standard"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Expires</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {fmtMY(approvalModal.expiresAt)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                The shop owner has been notified.
              </p>
            </div>

            <button
              onClick={() => setApprovalModal(null)}
              className="mt-4 w-full bg-[#003366] hover:bg-[#002244] text-white rounded-xl
                         py-2.5 text-sm font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
            Shop Approvals
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {loading ? "Loading…" : `${shops.length} pending shop${shops.length !== 1 ? "s" : ""} awaiting review`}
          </p>
        </div>
        <button
          onClick={load}
          className="text-xs text-blue-600 dark:text-blue-400 border border-blue-200
                     dark:border-blue-800 rounded-xl px-3 py-1.5 hover:bg-blue-50
                     dark:hover:bg-blue-900/20 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by shop name or owner email…"
          className="w-full pl-9 bg-white dark:bg-slate-800 border border-gray-200
                     dark:border-slate-700 rounded-xl px-3 py-2 text-sm
                     text-slate-700 dark:text-slate-300 min-h-[40px]
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-white dark:bg-slate-800 rounded-2xl
                                    animate-pulse border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <span className="text-5xl mb-3">✅</span>
          <p className="font-semibold text-slate-700 dark:text-slate-300">No pending approvals</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {search ? "Try adjusting your search." : "All shops have been reviewed."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((shop) => (
            <div
              key={shop.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100
                         dark:border-slate-700 p-4"
            >
              <div className="flex items-start gap-3">
                {shop.shopBannerUrl && (
                  <img
                    src={shop.shopBannerUrl}
                    alt={shop.shopName}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-slate-100"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                      {shop.shopName}
                    </p>
                    {shop.shopSlug && (
                      <span className="text-[10px] text-slate-400 font-mono">/{shop.shopSlug}</span>
                    )}
                    <span className="text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30
                                     text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                      Pending
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {shop.ownerEmail}
                  </p>
                  {(shop.shopCategories ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(shop.shopCategories ?? []).map((c) => (
                        <span key={c}
                              className="text-[10px] px-1.5 py-0.5 rounded-full
                                         bg-blue-50 dark:bg-blue-900/30
                                         text-blue-600 dark:text-blue-400 font-medium">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  {shop.shopBio && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">
                      {shop.shopBio}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    Submitted {shop.createdAt
                      ? new Date(shop.createdAt).toLocaleDateString("en-MY", {
                          day: "numeric", month: "short", year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50
                              dark:border-slate-700/50">
                {shop.shopSlug && (
                  <a
                    href={`${import.meta.env.VITE_MAIN_APP_URL ?? ""}/shop/${shop.shopSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-blue-600
                               dark:text-blue-400 border border-blue-200
                               dark:border-blue-800 rounded-xl px-2.5 py-1.5
                               hover:bg-blue-50 dark:hover:bg-blue-900/20
                               transition-colors min-h-[34px]"
                  >
                    <ExternalLink className="w-3 h-3" /> Preview
                  </a>
                )}
                <button
                  onClick={() => handleApprove(shop)}
                  disabled={processing === shop.id}
                  className="flex items-center gap-1 text-[11px] text-green-600
                             dark:text-green-400 border border-green-200
                             dark:border-green-800 rounded-xl px-3 py-1.5
                             hover:bg-green-50 dark:hover:bg-green-900/20
                             transition-colors min-h-[34px] disabled:opacity-50 font-medium"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {processing === shop.id ? "…" : "Approve"}
                </button>
                <button
                  onClick={() => handleReject(shop)}
                  disabled={processing === shop.id}
                  className="flex items-center gap-1 text-[11px] text-red-500
                             border border-red-200 dark:border-red-800 rounded-xl
                             px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20
                             transition-colors min-h-[34px] disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {processing === shop.id ? "…" : "Reject"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
