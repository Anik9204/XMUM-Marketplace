import { useEffect, useState, useRef } from "react";
import {
  ExternalLink, Trash2, Search, PauseCircle, PlayCircle, RefreshCw,
  ChevronDown, AlertTriangle, Clock, Ban, X,
} from "lucide-react";
import { updateDoc, doc, getDoc } from "firebase/firestore";
import { getShops, deleteShop, writeAuditLog, renewShopSubscription, db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { AdminShop } from "../lib/types";

interface SubscriptionConfig {
  subscriptionDays: number;
  graceDays:        number;
  reminderDays:     number;
}

const DEFAULT_CFG: SubscriptionConfig = { subscriptionDays: 30, graceDays: 30, reminderDays: 7 };

function fmtMY(ms: number): string {
  return new Date(ms).toLocaleDateString("en-MY", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function daysLeft(ms: number): number {
  return Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000));
}

export default function ShopsPage() {
  const { adminUser, isAdmin } = useAuth();
  const [shops, setShops]       = useState<AdminShop[]>([]);
  const [cfg, setCfg]           = useState<SubscriptionConfig>(DEFAULT_CFG);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter]     = useState("");
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [suspending, setSuspending] = useState<string | null>(null);
  const [renewing, setRenewing]   = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Extend grace modal
  const [extendModal, setExtendModal] = useState<AdminShop | null>(null);
  const [extendDays, setExtendDays]   = useState("7");

  // Deactivate typed confirmation
  const [deactivateModal, setDeactivateModal] = useState<AdminShop | null>(null);
  const [deactivateInput, setDeactivateInput] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const [data, cfgSnap] = await Promise.all([
        getShops(200),
        getDoc(doc(db, "appConfig", "subscriptions")),
      ]);
      setShops(data as AdminShop[]);
      if (cfgSnap.exists()) {
        const d = cfgSnap.data();
        setCfg({
          subscriptionDays: d.subscriptionDays ?? DEFAULT_CFG.subscriptionDays,
          graceDays:        d.graceDays        ?? DEFAULT_CFG.graceDays,
          reminderDays:     d.reminderDays     ?? DEFAULT_CFG.reminderDays,
        });
      }
    } catch (e) {
      console.error("[ShopsPage] load failed:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleRenew(shop: AdminShop) {
    if (!window.confirm(
      `Renew subscription for "${shop.shopName}"?\n\nThis will set a new ${cfg.subscriptionDays}-day subscription starting now.`
    )) return;
    setRenewing(shop.id);
    setOpenMenuId(null);
    try {
      await renewShopSubscription(shop.id, shop.ownerUid, shop.shopName, adminUser?.email ?? "");
      const newExpiry = Date.now() + cfg.subscriptionDays * 24 * 60 * 60 * 1000;
      setShops((prev) =>
        prev.map((s) =>
          s.id === shop.id
            ? { ...s, subscriptionStatus: "active" as const, subscriptionExpiresAt: newExpiry, isSuspended: false }
            : s
        )
      );
      void writeAuditLog({
        actorUid: adminUser?.uid ?? "", actorEmail: adminUser?.email ?? "",
        action: "shop_subscription_renewed",
        label: `Renewed subscription for "${shop.shopName}"`,
        targetId: shop.id, targetType: "shop", targetLabel: shop.shopName, createdAt: Date.now(),
      });
    } catch (e) {
      console.error("[ShopsPage] renew failed:", e);
      alert("Failed to renew subscription. Check Firestore permissions.");
    } finally {
      setRenewing(null);
    }
  }

  async function handleDelete(shop: AdminShop) {
    if (!window.confirm(`Delete shop "${shop.shopName}"? This cannot be undone.`)) return;
    setDeleting(shop.id);
    setOpenMenuId(null);
    try {
      await deleteShop(shop.id);
      setShops((prev) => prev.filter((s) => s.id !== shop.id));
      void writeAuditLog({
        actorUid: adminUser?.uid ?? "", actorEmail: adminUser?.email ?? "",
        action: "shop_deleted", label: `Deleted shop "${shop.shopName}"`,
        targetId: shop.id, targetType: "shop", targetLabel: shop.shopName, createdAt: Date.now(),
      });
    } catch (e) {
      console.error("[ShopsPage] delete failed:", e);
      alert("Failed to delete shop. Check Firestore permissions.");
    } finally {
      setDeleting(null);
    }
  }

  async function handleSuspendToggle(shop: AdminShop) {
    const action = shop.isSuspended ? "unsuspend" : "suspend";
    if (!window.confirm(
      `${action === "suspend" ? "Suspend" : "Unsuspend"} shop "${shop.shopName}"?\n` +
      (action === "suspend"
        ? "The shop will be hidden from Campus Market."
        : "The shop will become visible again.")
    )) return;
    setSuspending(shop.id);
    try {
      await updateDoc(doc(db, "shops", shop.id), { isSuspended: !shop.isSuspended });
      setShops((prev) => prev.map((s) => s.id === shop.id ? { ...s, isSuspended: !s.isSuspended } : s));
      void writeAuditLog({
        actorUid: adminUser?.uid ?? "", actorEmail: adminUser?.email ?? "",
        action: shop.isSuspended ? "shop_unsuspended" : "shop_suspended",
        label: `${shop.isSuspended ? "Unsuspended" : "Suspended"} shop "${shop.shopName}"`,
        targetId: shop.id, targetType: "shop", targetLabel: shop.shopName, createdAt: Date.now(),
      });
    } catch (e) {
      console.error("[ShopsPage] suspend failed:", e);
      alert("Failed to update shop. Check Firestore permissions.");
    } finally {
      setSuspending(null);
    }
  }

  async function handleForceExpire(shop: AdminShop) {
    if (!window.confirm(
      `Force expire "${shop.shopName}" now?\n\nThis will immediately set the shop to Grace Period and hide it.`
    )) return;
    setActioning(shop.id);
    setOpenMenuId(null);
    try {
      const now = Date.now();
      await updateDoc(doc(db, "shops", shop.id), {
        subscriptionStatus: "grace",
        isActive:           false,
        subscriptionExpiresAt: now,
      });
      setShops((prev) =>
        prev.map((s) =>
          s.id === shop.id
            ? { ...s, subscriptionStatus: "grace" as const, subscriptionExpiresAt: now }
            : s
        )
      );
      void writeAuditLog({
        actorUid: adminUser?.uid ?? "", actorEmail: adminUser?.email ?? "",
        action: "shop_force_expired",
        label: `Force expired shop "${shop.shopName}"`,
        targetId: shop.id, targetType: "shop", targetLabel: shop.shopName, createdAt: Date.now(),
      });
    } catch (e) {
      console.error("[ShopsPage] force expire failed:", e);
      alert("Failed to force expire. Check Firestore permissions.");
    } finally {
      setActioning(null);
    }
  }

  async function handleExtendGrace() {
    if (!extendModal) return;
    const days = parseInt(extendDays) || 0;
    if (days <= 0) { alert("Please enter a valid number of days."); return; }
    setActioning(extendModal.id);
    try {
      await updateDoc(doc(db, "shops", extendModal.id), {
        gracePeriodExtendedBy: days,
        gracePeriodExtendedAt: Date.now(),
      });
      void writeAuditLog({
        actorUid: adminUser?.uid ?? "", actorEmail: adminUser?.email ?? "",
        action: "shop_grace_extended",
        label: `Extended grace period for "${extendModal.shopName}" by ${days} days`,
        targetId: extendModal.id, targetType: "shop", targetLabel: extendModal.shopName, createdAt: Date.now(),
      });
      setExtendModal(null);
      setExtendDays("7");
    } catch (e) {
      console.error("[ShopsPage] extend grace failed:", e);
      alert("Failed to extend grace period. Check Firestore permissions.");
    } finally {
      setActioning(null);
    }
  }

  async function handlePermanentDeactivate() {
    if (!deactivateModal) return;
    if (deactivateInput !== "DEACTIVATE") return;
    setActioning(deactivateModal.id);
    setDeactivateModal(null);
    try {
      await updateDoc(doc(db, "shops", deactivateModal.id), {
        subscriptionStatus: "expired",
        isActive:           false,
        approvalStatus:     "deactivated",
      });
      setShops((prev) =>
        prev.map((s) =>
          s.id === deactivateModal.id
            ? { ...s, subscriptionStatus: "expired" as const, approvalStatus: "rejected" as const }
            : s
        )
      );
      void writeAuditLog({
        actorUid: adminUser?.uid ?? "", actorEmail: adminUser?.email ?? "",
        action: "shop_permanently_deactivated",
        label: `Permanently deactivated shop "${deactivateModal.shopName}"`,
        targetId: deactivateModal.id, targetType: "shop", targetLabel: deactivateModal.shopName, createdAt: Date.now(),
      });
      setDeactivateInput("");
    } catch (e) {
      console.error("[ShopsPage] deactivate failed:", e);
      alert("Failed to deactivate shop. Check Firestore permissions.");
    } finally {
      setActioning(null);
    }
  }

  function getSubscriptionBadge(shop: AdminShop) {
    const status    = shop.subscriptionStatus;
    const expiresAt = shop.subscriptionExpiresAt;
    const now       = Date.now();

    if (!shop.approvalStatus || shop.approvalStatus === "pending") {
      return <span className="text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">Pending</span>;
    }
    if (shop.approvalStatus === "rejected") {
      return <span className="text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">Rejected</span>;
    }

    const expiryStr = expiresAt ? fmtMY(expiresAt) : null;

    if (status === "trial") {
      const expired = expiresAt ? expiresAt < now : false;
      if (!expired && expiresAt) {
        const dl = daysLeft(expiresAt);
        if (dl <= cfg.reminderDays && dl > 0) {
          return (
            <div>
              <span className="text-[10px] font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                Trial · Expiring Soon
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">Expires: {expiryStr}</p>
            </div>
          );
        }
      }
      return (
        <div>
          <span className="text-[10px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">Trial Active</span>
          {expiryStr && <p className="text-[10px] text-slate-400 mt-0.5">Expires: {expiryStr}</p>}
        </div>
      );
    }

    if (status === "active") {
      if (expiresAt) {
        const dl = daysLeft(expiresAt);
        if (dl <= cfg.reminderDays && dl > 0) {
          return (
            <div>
              <span className="text-[10px] font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                Expiring Soon
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">Expires: {expiryStr}</p>
            </div>
          );
        }
      }
      return (
        <div>
          <span className="text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">Active</span>
          {expiryStr && <p className="text-[10px] text-slate-400 mt-0.5">Expires: {expiryStr}</p>}
        </div>
      );
    }

    if (status === "grace") {
      const graceEndMs = expiresAt ? expiresAt + cfg.graceDays * 24 * 60 * 60 * 1000 : 0;
      const graceDaysLeft = graceEndMs ? Math.max(0, Math.ceil((graceEndMs - now) / (24 * 60 * 60 * 1000))) : 0;
      return (
        <div>
          <span className="text-[10px] font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">
            Grace: {graceDaysLeft}d left
          </span>
          {expiryStr && <p className="text-[10px] text-slate-400 mt-0.5">Expired: {expiryStr}</p>}
        </div>
      );
    }

    if (status === "expired") {
      return (
        <div>
          <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">Expired</span>
          {expiryStr && <p className="text-[10px] text-slate-400 mt-0.5">Expired: {expiryStr}</p>}
        </div>
      );
    }

    return <span className="text-slate-400 text-xs">—</span>;
  }

  const allCategories = Array.from(new Set(shops.flatMap((s) => s.shopCategories ?? []))).sort();

  const filtered = shops.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q || s.shopName?.toLowerCase().includes(q) || s.ownerEmail?.toLowerCase().includes(q);
    const matchesCategory = !categoryFilter || (s.shopCategories ?? []).includes(categoryFilter);
    const matchesStatus =
      !statusFilter ||
      (statusFilter === "suspended" && s.isSuspended) ||
      (statusFilter === "grace"     && s.subscriptionStatus === "grace") ||
      (statusFilter === "expired"   && s.subscriptionStatus === "expired") ||
      (statusFilter === "trial"     && s.subscriptionStatus === "trial") ||
      (statusFilter === "active"    && s.subscriptionStatus === "active" && !s.isSuspended);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="p-6">
      {/* Extend Grace Modal */}
      {extendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">Extend Grace Period</h2>
              <button onClick={() => setExtendModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Add extra days to the grace period for <strong className="text-slate-700 dark:text-slate-300">{extendModal.shopName}</strong>.
            </p>
            <input
              type="number"
              min={1}
              max={90}
              value={extendDays}
              onChange={(e) => setExtendDays(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700
                         rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200
                         focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px] mb-4"
              placeholder="Number of extra days"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setExtendModal(null)}
                className="flex-1 border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400
                           rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExtendGrace}
                disabled={actioning === extendModal.id}
                className="flex-1 bg-[#003366] hover:bg-[#002244] text-white rounded-xl py-2.5
                           text-sm font-semibold transition disabled:opacity-60"
              >
                {actioning === extendModal.id ? "Saving…" : "Extend"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Deactivate Modal */}
      {deactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-red-600 dark:text-red-400">Permanently Deactivate</h2>
              <button onClick={() => { setDeactivateModal(null); setDeactivateInput(""); }} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              This will permanently remove <strong className="text-slate-700 dark:text-slate-300">{deactivateModal.shopName}</strong> from all marketplace listings.
            </p>
            <p className="text-xs text-red-500 mb-4">This action cannot be undone.</p>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Type <span className="font-mono text-red-500">DEACTIVATE</span> to confirm
            </label>
            <input
              type="text"
              value={deactivateInput}
              onChange={(e) => setDeactivateInput(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800
                         rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200
                         focus:outline-none focus:ring-2 focus:ring-red-400 min-h-[40px] mb-4"
              placeholder="DEACTIVATE"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setDeactivateModal(null); setDeactivateInput(""); }}
                className="flex-1 border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400
                           rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handlePermanentDeactivate}
                disabled={deactivateInput !== "DEACTIVATE" || actioning === deactivateModal.id}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5
                           text-sm font-semibold transition disabled:opacity-40"
              >
                {actioning === deactivateModal.id ? "Deactivating…" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">Campus Market Shops</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {loading ? "Loading…" : `${shops.length} total shop${shops.length !== 1 ? "s" : ""}`}
            {!loading && filtered.length !== shops.length && ` · ${filtered.length} shown`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px]">
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
        {allCategories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                       rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300
                       min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                     rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300
                     min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="grace">Grace Period</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white dark:bg-slate-800 rounded-2xl
                                    animate-pulse border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <span className="text-5xl mb-3">🏪</span>
          <p className="font-semibold text-slate-700 dark:text-slate-300">No shops found</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {search || categoryFilter ? "Try adjusting your filters." : "No shops have been created yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100
                        dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700
                               text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="text-left px-4 py-3 font-medium">Shop Name</th>
                  <th className="text-left px-4 py-3 font-medium">Owner Email</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-right px-4 py-3 font-medium">Listings</th>
                  <th className="text-right px-4 py-3 font-medium">Inquiries</th>
                  <th className="text-right px-4 py-3 font-medium">Rating</th>
                  <th className="text-left px-4 py-3 font-medium">Created At</th>
                  <th className="text-left px-4 py-3 font-medium">Subscription</th>
                  <th className="px-4 py-3 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {filtered.map((shop) => (
                  <tr key={shop.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {shop.shopBannerUrl && (
                          <img
                            src={shop.shopBannerUrl}
                            alt={shop.shopName}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0 bg-slate-100"
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{shop.shopName || "—"}</p>
                            {shop.isSuspended && (
                              <span className="text-[10px] font-semibold bg-red-100 dark:bg-red-900/30
                                               text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full flex-shrink-0">
                                Suspended
                              </span>
                            )}
                          </div>
                          {shop.shopSlug && <p className="text-[10px] text-slate-400">/{shop.shopSlug}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{shop.ownerEmail || "—"}</td>
                    <td className="px-4 py-3">
                      {(shop.shopCategories ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(shop.shopCategories ?? []).slice(0, 2).map((c) => (
                            <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-full
                                                     bg-blue-50 dark:bg-blue-900/30
                                                     text-blue-600 dark:text-blue-400 font-medium">{c}</span>
                          ))}
                          {(shop.shopCategories ?? []).length > 2 && (
                            <span className="text-[10px] text-slate-400">+{(shop.shopCategories ?? []).length - 2}</span>
                          )}
                        </div>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{shop.activeListingCount ?? 0}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{shop.inquiryCount ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      {shop.rating != null ? (
                        <span className="text-amber-500 font-medium">
                          ★ {shop.rating.toFixed(1)}
                          <span className="text-slate-400 font-normal text-[10px] ml-0.5">({shop.totalReviews ?? 0})</span>
                        </span>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {shop.createdAt ? new Date(shop.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3">{getSubscriptionBadge(shop)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1" ref={openMenuId === shop.id ? menuRef : undefined}>
                        {shop.shopSlug && (
                          <a
                            href={`${import.meta.env.VITE_MAIN_APP_URL ?? ""}/shop/${shop.shopSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View public shop page"
                            className="flex items-center gap-1 text-[11px] text-blue-600
                                       dark:text-blue-400 border border-blue-200
                                       dark:border-blue-800 rounded-xl px-2.5 py-1.5
                                       hover:bg-blue-50 dark:hover:bg-blue-900/20
                                       transition-colors min-h-[34px]"
                          >
                            <ExternalLink className="w-3 h-3" /> View
                          </a>
                        )}
                        <button
                          onClick={() => handleSuspendToggle(shop)}
                          disabled={suspending === shop.id}
                          title={shop.isSuspended ? "Unsuspend shop" : "Suspend shop"}
                          className={`flex items-center gap-1 text-[11px] rounded-xl px-2.5 py-1.5
                                      border transition-colors min-h-[34px] disabled:opacity-50
                                      ${shop.isSuspended
                                        ? "border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                                        : "border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"}`}
                        >
                          {suspending === shop.id
                            ? "…"
                            : shop.isSuspended
                              ? <><PlayCircle className="w-3 h-3" /> Unsuspend</>
                              : <><PauseCircle className="w-3 h-3" /> Suspend</>}
                        </button>
                        {(shop.subscriptionStatus === "grace" || shop.subscriptionStatus === "expired") && (
                          <button
                            onClick={() => handleRenew(shop)}
                            disabled={renewing === shop.id}
                            title="Renew subscription"
                            className="flex items-center gap-1 text-[11px] text-blue-600
                                       dark:text-blue-400 border border-blue-200
                                       dark:border-blue-800 rounded-xl px-2.5 py-1.5
                                       hover:bg-blue-50 dark:hover:bg-blue-900/20
                                       transition-colors min-h-[34px] disabled:opacity-50"
                          >
                            <RefreshCw className="w-3 h-3" />
                            {renewing === shop.id ? "…" : "Renew"}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(shop)}
                          disabled={deleting === shop.id}
                          title="Delete shop"
                          className="flex items-center gap-1 text-[11px] text-red-500
                                     border border-red-200 dark:border-red-800 rounded-xl
                                     px-2.5 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20
                                     transition-colors min-h-[34px] disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          {deleting === shop.id ? "…" : "Delete"}
                        </button>

                        {/* Admin-only action dropdown */}
                        {isAdmin && (
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === shop.id ? null : shop.id)}
                              title="More actions"
                              className="flex items-center text-[11px] text-slate-500 border border-slate-200
                                         dark:border-slate-700 rounded-xl px-2 py-1.5 hover:bg-slate-50
                                         dark:hover:bg-slate-700/50 transition-colors min-h-[34px]"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            {openMenuId === shop.id && (
                              <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white dark:bg-slate-800
                                              border border-gray-100 dark:border-slate-700 rounded-xl shadow-lg py-1">
                                {(shop.subscriptionStatus === "active" || shop.subscriptionStatus === "trial") && (
                                  <button
                                    onClick={() => { setOpenMenuId(null); handleForceExpire(shop); }}
                                    disabled={actioning === shop.id}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-amber-600
                                               dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20
                                               transition-colors text-left"
                                  >
                                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                    Force Expire Now
                                  </button>
                                )}
                                {shop.subscriptionStatus === "grace" && (
                                  <button
                                    onClick={() => { setOpenMenuId(null); setExtendDays("7"); setExtendModal(shop); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-blue-600
                                               dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20
                                               transition-colors text-left"
                                  >
                                    <Clock className="w-3 h-3 flex-shrink-0" />
                                    Extend Grace Period
                                  </button>
                                )}
                                <button
                                  onClick={() => { setOpenMenuId(null); setDeactivateInput(""); setDeactivateModal(shop); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-red-500
                                             hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                                >
                                  <Ban className="w-3 h-3 flex-shrink-0" />
                                  Permanently Deactivate
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
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
