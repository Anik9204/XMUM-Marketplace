import { useState, useEffect, useRef, useMemo } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getUserListings, deleteListing, markAsSold, getListing, LISTING_EXPIRY_MS, LISTING_REMINDER_MS } from "@/lib/listings";
import { getUserConversations } from "@/lib/messaging";
import { sendDailyDigestIfDue } from "@/lib/notifications";
import { Listing, Shop } from "@/lib/types";
import { getSavedListings } from "@/lib/savedListings";
import { getShopsByOwner, getShopsWhereEditor } from "@/lib/shops";
import ListingCard from "@/components/ListingCard";
import AuthModal from "@/components/AuthModal";
import ReportHoldModal from "@/components/ReportHoldModal";
import {
  User, CheckCircle, AlertCircle, CheckCircle2, Settings, Clock, X,
  Bookmark, Store, MessageSquare, Plus,
  Pencil, Trash2, Eye, Package, BarChart2, ChevronRight,
  Tag, BadgeCheck,
} from "lucide-react";
import { logOut } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { useLocation, Link } from "wouter";
import { addNotification } from "@/lib/notifications";

function SuccessToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const hide = setTimeout(() => setVisible(false), 3000);
    const done = setTimeout(onDone, 3400);
    return () => { clearTimeout(hide); clearTimeout(done); };
  }, [onDone]);
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#003366] dark:bg-blue-700 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl transition-all duration-400 ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"}`}>
      <CheckCircle2 size={16} className="text-green-300 shrink-0" />
      {message}
    </div>
  );
}

type ListingTab = "active" | "sold" | "archived" | "saved";

const TYPE_COLOR: Record<string, { dot: string; label: string }> = {
  "buy-sell":   { dot: "bg-blue-500",   label: "Buy & Sell" },
  "lost-found": { dot: "bg-teal-500",   label: "Lost & Found" },
  "jobs":       { dot: "bg-purple-500", label: "Jobs" },
  "assistance": { dot: "bg-orange-500", label: "Assistance" },
  "rental":     { dot: "bg-amber-500",  label: "Rental" },
};

const fmtRM = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function OwnerListingRow({
  listing, now, lang, t,
  onDelete, onMarkSold, onEdit,
}: {
  listing: Listing; now: number; lang: string; t: any;
  onDelete: () => void; onMarkSold: () => void;
  onEdit: () => void;
}) {
  const isSold = listing.status === "sold";
  const expiringSoon = !isSold && listing.status === "active"
    && now - listing.createdAt >= LISTING_REMINDER_MS
    && now - listing.createdAt < LISTING_EXPIRY_MS;
  const daysLeft = Math.ceil((listing.createdAt + LISTING_EXPIRY_MS - now) / 86_400_000);
  const expiryPct = Math.max(0, Math.min(100, ((LISTING_EXPIRY_MS - (now - listing.createdAt)) / LISTING_EXPIRY_MS) * 100));
  const typeInfo = TYPE_COLOR[listing.type] ?? TYPE_COLOR["buy-sell"];

  const priceStr = (() => {
    if (listing.type === "buy-sell") return listing.price === 0 ? t.free : `RM ${fmtRM(listing.price ?? 0)}`;
    if (listing.type === "jobs" && listing.price) return `RM ${fmtRM(listing.price)}/hr`;
    if (listing.type === "rental" && listing.rentalPricePerDay) return `RM ${fmtRM(listing.rentalPricePerDay)}/day`;
    if (listing.type === "assistance" && listing.price != null) return `RM ${fmtRM(listing.price)}`;
    return null;
  })();

  const relTime = (() => {
    const diff = now - listing.createdAt;
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor(diff / 60_000);
    if (m < 60) return m <= 1 ? "Just now" : `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
  })();

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden transition-all ${
      isSold ? "border-gray-100 dark:border-slate-700 opacity-70" : "border-gray-100 dark:border-slate-700"
    }`}>
      <Link href={`/listing/${listing.id}`} className="block">
        <div className="flex gap-3 p-3">
          {/* Thumbnail */}
          <div className="relative shrink-0 w-[88px] h-[88px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700">
            {listing.photos[0] ? (
              <img
                src={listing.photos[0]}
                alt={listing.title}
                className={`w-full h-full object-cover ${isSold ? "opacity-50" : ""}`}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package size={28} className="text-slate-300 dark:text-slate-500" />
              </div>
            )}
            {isSold && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="text-white text-[9px] font-black tracking-widest uppercase px-2 py-0.5 border border-white/60 rounded">
                  {listing.type === "lost-found" ? "Resolved" : "Sold"}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 py-0.5">
            <div className="flex items-start justify-between gap-1">
              <h3 className={`text-sm font-semibold leading-snug line-clamp-1 ${
                isSold ? "text-gray-400 dark:text-slate-500" : "text-gray-900 dark:text-slate-100"
              }`}>
                {listing.title}
              </h3>
              {listing.isReportHeld && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 uppercase tracking-wide">Under Review</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${typeInfo.dot}`} />
              <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wide font-medium">
                {typeInfo.label}
              </span>
              {listing.condition && listing.type === "buy-sell" && (
                <>
                  <span className="text-gray-200 dark:text-slate-600">·</span>
                  <span className={`text-[10px] font-semibold ${listing.condition === "new" ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {listing.condition === "new" ? "New" : "Used"}
                  </span>
                </>
              )}
            </div>

            {priceStr && (
              <p className={`text-base font-bold mt-1 ${
                isSold ? "text-gray-300 dark:text-slate-600 line-through" :
                listing.type === "jobs" ? "text-emerald-600 dark:text-emerald-400" :
                listing.type === "assistance" ? "text-orange-600 dark:text-orange-400" :
                listing.type === "rental" ? "text-amber-600 dark:text-amber-400" :
                "text-[#003366] dark:text-blue-400"
              }`}>
                {priceStr}
              </p>
            )}

            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-gray-400 dark:text-slate-500">{relTime}</span>
              <>
                <span className="text-gray-200 dark:text-slate-700">·</span>
                <span className="flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-slate-500">
                  <Eye size={9} /> {listing.viewCount ?? 0} views
                </span>
              </>
            </div>

            {/* Expiry bar */}
            {expiringSoon && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    {daysLeft}d left
                  </span>
                </div>
                <div className="h-1 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: `${expiryPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Action row */}
      {!isSold && (
        <div className="flex border-t border-gray-50 dark:border-slate-700/60 divide-x divide-gray-50 dark:divide-slate-700/60">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors min-h-[40px]"
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            onClick={onMarkSold}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-[#003366] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors min-h-[40px]"
          >
            <BadgeCheck size={12} />
            {listing.type === "lost-found" ? "Resolved" : "Sold"}
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center px-4 py-2.5 text-[11px] font-medium text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[40px]"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {isSold && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-50 dark:border-slate-700/60">
          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wide">
            {listing.type === "lost-found" ? "Resolved" : "Sold"}
          </span>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600 transition-colors"
          >
            <Trash2 size={11} /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { t, lang } = useLang();
  const { user, userProfile, avatarOverride } = useAuth();
  const [, navigate] = useLocation();

  const [showAuth, setShowAuth] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdModalAction, setHoldModalAction] = useState<"delete" | "edit">("delete");
  const [deleteError, setDeleteError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [expiryReminders, setExpiryReminders] = useState<Listing[]>([]);
  const [tab, setTab] = useState<ListingTab>("active");
  const [refreshCounter, setRefreshCounter] = useState(0);

  const [savedListings, setSavedListings] = useState<Listing[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);

  const [myShops, setMyShops] = useState<Shop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const listingsCache = useRef<Listing[]>([]);
  const now = useMemo(() => Date.now(), [listings, refreshCounter]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    listingsCache.current = [];
    setLoading(true);
    getUserListings(user.uid)
      .then((data) => {
        if (!isMounted) return;
        const expired = data.filter(l => now - l.createdAt >= LISTING_EXPIRY_MS && l.status === "active");
        const active = data.filter(l => !(now - l.createdAt >= LISTING_EXPIRY_MS && l.status === "active"));
        if (expired.length > 0) {
          Promise.allSettled(expired.map(l => deleteListing(l))).then((results) => {
            if (!isMounted) return;
            const actuallyDeleted = expired.filter((_, i) => results[i].status === "fulfilled");
            if (actuallyDeleted.length === 0) return;
            if (actuallyDeleted.length === 1) setSuccessToast(`"${actuallyDeleted[0].title}" has been automatically removed after 30 days.`);
            else setSuccessToast(`${actuallyDeleted.length} listings have been automatically removed after 30 days.`);
            actuallyDeleted.forEach(l => {
              addNotification(user.uid, { type: "listing_deleted", title: "Listing Removed", body: `"${l.title}" was automatically removed after 30 days.`, listingId: l.id });
            });
          });
        }
        listingsCache.current = active;
        setListings(active);
        sendDailyDigestIfDue(user.uid, active);
        getUserConversations(user.uid).then(convs => {
          if (!isMounted) return;
          setTotalMessages(convs.reduce((sum, c) => sum + (c.unreadCount?.[user.uid] ?? 0), 0));
        }).catch(() => {});
        const expiringSoon = active.filter(l =>
          l.status === "active" &&
          now - l.createdAt >= LISTING_REMINDER_MS &&
          now - l.createdAt < LISTING_EXPIRY_MS
        );
        if (expiringSoon.length > 0) setExpiryReminders(expiringSoon);
      })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [user, refreshCounter]);

  useEffect(() => {
    if (!user) return;
    getSavedListings(user.uid).then((saved) => setSavedCount(saved.length)).catch(() => {});
  }, [user?.uid]);

  useEffect(() => {
    if (tab !== "saved" || !user) return;
    let mounted = true;
    setSavedLoading(true);
    getSavedListings(user.uid)
      .then(async (saved) => {
        if (!mounted) return;
        setSavedCount(saved.length);
        const results = await Promise.all(saved.map(s => getListing(s.listingId).catch(() => null)));
        if (!mounted) return;
        setSavedListings(results.filter((l): l is Listing => l !== null));
      })
      .catch(() => {})
      .finally(() => { if (mounted) setSavedLoading(false); });
    return () => { mounted = false; };
  }, [tab, user?.uid]);

  useEffect(() => {
    if (!user) return;
    setShopsLoading(true);
    Promise.all([getShopsByOwner(user.uid), getShopsWhereEditor(user.uid)]).then(([owned, editing]) => {
      const seen = new Set<string>();
      const merged: Shop[] = [];
      for (const s of [...owned, ...editing]) {
        if (!seen.has(s.id)) { seen.add(s.id); merged.push(s); }
      }
      setMyShops(merged.filter(s => s.isActive !== false));
    }).catch(() => {}).finally(() => setShopsLoading(false));
  }, [user?.uid]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <User size={48} className="text-gray-200 dark:text-slate-600 mb-4" />
        <p className="text-gray-600 dark:text-slate-300 font-medium mb-1">{t.loginToPost}</p>
        <button onClick={() => setShowAuth(true)} className="mt-3 bg-[#003366] dark:bg-blue-600 text-white px-5 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold">
          {t.signIn}
        </button>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  const handleDelete = async (listing: Listing) => {
    setDeleting(true);
    setDeleteError("");
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        await auth.currentUser.getIdToken(true);
      }
      await deleteListing(listing);
      const updated = listingsCache.current.filter((l) => l.id !== listing.id);
      listingsCache.current = updated;
      setListings(updated);
      setDeleteTarget(null);
      setSuccessToast("Your post has been deleted successfully.");
    } catch (err: any) {
      const code: string = err?.code ?? "";
      if (code === "report-hold") {
        setHoldModalAction("delete");
        setShowHoldModal(true);
        // Still remove from visible list since it's now archived/hidden
        const updated = listingsCache.current.filter((l) => l.id !== listing.id);
        listingsCache.current = updated;
        setListings(updated);
        setDeleteTarget(null);
      } else if (code === "permission-denied" || code === "storage/unauthorized") {
        setDeleteError("Permission denied. Make sure you are signed in with your XMUM email.");
      } else if (code === "not-found" || code === "storage/object-not-found") {
        const updated = listingsCache.current.filter((l) => l.id !== listing.id);
        listingsCache.current = updated;
        setListings(updated);
        setDeleteTarget(null);
        setSuccessToast("Your post has been deleted successfully.");
      } else if (code === "unavailable" || code === "storage/retry-limit-exceeded") {
        setDeleteError("No connection. Please check your internet and try again.");
      } else {
        setDeleteError(err?.message ?? "Something went wrong. Please try again.");
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleMarkAsSold = async (listing: Listing) => {
    try {
      await markAsSold(listing.id);
      const updated = listingsCache.current.map(l => l.id === listing.id ? { ...l, status: "sold" as const } : l);
      listingsCache.current = updated;
      setListings(updated);
      setSuccessToast(t.markedAsSold);
      addNotification(user.uid, {
        type: "listing_sold",
        title: listing.type === "lost-found" ? "Item Resolved" : "Item Marked as Sold",
        body: `"${listing.title}" has been marked as ${listing.type === "lost-found" ? "resolved" : "sold"}.`,
        listingId: listing.id,
      });
    } catch { /* silently ignore */ }
  };

  const avatarSrc = avatarOverride ?? userProfile?.avatarUrl ?? "";
  const displayName = userProfile?.fullName || user.email?.split("@")[0] || "";

  const activeCount = listings.filter(l => !l.isArchived && l.status !== "sold").length;
  const soldCount   = listings.filter(l => l.status === "sold").length;
  const viewCount   = listings.reduce((sum, l) => sum + (l.viewCount ?? 0), 0);

  const filteredListings = listings.filter(l => {
    if (tab === "active") return !l.isArchived && l.status !== "sold";
    if (tab === "sold")   return l.status === "sold";
    if (tab === "archived") return l.isArchived;
    return true;
  });

  const isGridLoading = tab === "saved" ? savedLoading : loading;
  const gridListings  = tab === "saved" ? savedListings : filteredListings;

  const subTabs: { key: ListingTab; label: string; count: number }[] = [
    { key: "active", label: "Active", count: activeCount },
    { key: "sold",   label: "Sold",   count: soldCount },
    { key: "saved",  label: "Saved",  count: savedCount },
  ];

  const memberSince = userProfile
    ? new Date(userProfile.createdAt).toLocaleDateString("en-MY", { month: "short", year: "numeric" })
    : "—";

  return (
    <>
      {successToast && <SuccessToast message={successToast} onDone={() => setSuccessToast("")} />}

      <div className="max-w-2xl mx-auto pb-28 sm:pb-8 animate-in fade-in duration-200">

        {/* ── PROFILE HEADER ─────────────────────────────────────── */}
        <div className="relative mb-4">
          {/* Gradient banner */}
          <div className="h-28 bg-gradient-to-br from-[#003366] via-[#004a99] to-[#0066cc] rounded-b-none" />

          {/* White card */}
          <div className="bg-white dark:bg-slate-800 mx-0 rounded-none sm:rounded-2xl sm:mx-4 border-x-0 sm:border border-gray-100 dark:border-slate-700 px-4 pb-4 shadow-sm">
            {/* Avatar + sign out row */}
            <div className="flex items-start justify-between -mt-10 mb-2">
              <div className="relative">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt="avatar"
                    className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white dark:ring-slate-800 shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#003366] to-[#0055aa] flex items-center justify-center text-white font-bold text-2xl ring-4 ring-white dark:ring-slate-800 shadow-lg">
                    {(user.email ?? "?")[0].toUpperCase()}
                  </div>
                )}
                {user.emailVerified && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
                    <CheckCircle size={13} className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-12">
                <button
                  onClick={() => navigate("/settings")}
                  className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Settings size={13} /> Settings
                </button>
              </div>
            </div>

            {/* Name + meta */}
            <h2 className="text-lg font-display font-bold text-gray-900 dark:text-slate-100 leading-tight">{displayName}</h2>
            <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {user.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                  <CheckCircle size={9} /> XMUM Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                  <AlertCircle size={9} /> Unverified
                </span>
              )}
              <span className="text-[10px] text-gray-400 dark:text-slate-500">Member since {memberSince}</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-slate-700">
              {[
                { icon: <Package size={14} className="text-[#003366] dark:text-blue-400" />, value: activeCount, label: "Active" },
                { icon: <BadgeCheck size={14} className="text-green-500" />, value: soldCount, label: "Sold" },
                { icon: <BarChart2 size={14} className="text-purple-500" />, value: viewCount, label: "Views" },
                { icon: <Bookmark size={14} className="text-amber-500" />, value: savedCount, label: "Saved", onClick: () => setTab("saved") },
              ].map(({ icon, value, label, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  disabled={!onClick}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-colors ${onClick ? "hover:bg-gray-50 dark:hover:bg-slate-700/50" : "cursor-default"}`}
                >
                  {icon}
                  <span className="text-base font-bold text-gray-900 dark:text-slate-100 leading-none">{loading ? "—" : value}</span>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── MAIN TABS ──────────────────────────────────────────── */}
        <div className="px-4">
          <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
            <button className={`chip chip-active`}>
              {t.myListings}
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="chip"
            >
              <Settings size={13} />
              {t.accountSettings}
            </button>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-2 mb-4">
            {subTabs.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => { setTab(key); if (key === "active") setRefreshCounter(c => c + 1); }}
                className={`chip ${tab === key ? "chip-active" : ""}`}
              >
                {key === "saved" && <Bookmark size={12} />}
                {label}
                {!loading && count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                    tab === key ? "bg-white/25" : "bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}

            <Link href="/post" className="ml-auto">
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-[#003366] dark:text-blue-400 hover:border-[#003366]/40 transition-colors">
                <Plus size={14} /> Post
              </button>
            </Link>
          </div>

          {/* Expiry banner (compact) */}
          {tab !== "saved" && expiryReminders.length > 0 && (
            <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3 flex items-center gap-3">
              <Clock size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="flex-1 text-xs text-amber-800 dark:text-amber-300 font-medium">
                {expiryReminders.length === 1
                  ? `"${expiryReminders[0].title}" expires soon — consider reposting`
                  : `${expiryReminders.length} listings expiring soon`}
              </p>
              <button onClick={() => setExpiryReminders([])} className="text-amber-400 hover:text-amber-600 transition-colors p-1">
                <X size={14} />
              </button>
            </div>
          )}

          {/* ── LISTINGS ─────────────────────────────────────────── */}
          {isGridLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-3 flex gap-3 animate-pulse">
                  <div className="w-[88px] h-[88px] rounded-xl bg-gray-100 dark:bg-slate-700 shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-3/4" />
                    <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded w-1/3" />
                    <div className="h-4 bg-gray-100 dark:bg-slate-700 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : gridListings.length === 0 ? (
            /* Empty states */
            tab === "saved" ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
                  <Bookmark size={28} className="text-amber-400" />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">No saved listings yet</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 max-w-xs">
                  Tap the bookmark on any listing to save it for later.
                </p>
                <Link href="/">
                  <button className="btn-primary mt-4 flex items-center gap-1.5">
                    Browse Listings
                  </button>
                </Link>
              </div>
            ) : tab === "sold" ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-4">
                  <BadgeCheck size={28} className="text-green-400" />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">No sold items yet</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Items you mark as sold will appear here.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                  <Tag size={28} className="text-[#003366] dark:text-blue-400" />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">{t.noListings}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 max-w-xs">
                  Post your first listing — it only takes a minute.
                </p>
                <Link href="/post">
                  <button className="btn-primary mt-4 flex items-center gap-1.5">
                    <Plus size={14} /> Post a Listing
                  </button>
                </Link>
              </div>
            )
          ) : tab === "saved" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gridListings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  showSaveButton
                  onUnsave={() => setSavedListings(prev => prev.filter(x => x.id !== l.id))}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredListings.map((l) => (
                <OwnerListingRow
                  key={l.id}
                  listing={l}
                  now={now}
                  lang={lang}
                  t={t}
                  onDelete={() => setDeleteTarget(l)}
                  onMarkSold={() => handleMarkAsSold(l)}
                  onEdit={() => {
                    if (l.isReportHeld === true) {
                      setHoldModalAction("edit");
                      setShowHoldModal(true);
                      return;
                    }
                    navigate(`/edit/${l.id}`);
                  }}
                />
              ))}
            </div>
          )}

          {/* ── MY SHOPS ─────────────────────────────────────────── */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-header">🏪 My Shops</h2>
              <Link href="/campus-market" className="text-xs text-[#003366] dark:text-blue-400 font-semibold flex items-center gap-0.5">
                Browse <ChevronRight size={12} />
              </Link>
            </div>
            {shopsLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-16 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 animate-pulse" />)}
              </div>
            ) : myShops.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 p-5 text-center">
                <Store size={28} className="mx-auto text-gray-200 dark:text-slate-600 mb-2" />
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">You don't have a shop yet.</p>
                <Link href="/create-shop">
                  <button className="flex items-center gap-1.5 mx-auto bg-[#003366] dark:bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-[#002244] transition">
                    <Plus size={12} /> Open Your Shop
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {myShops.map((shop) => (
                  <div key={shop.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-3 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                      {shop.logoUrl ? <img src={shop.logoUrl} alt="" className="w-full h-full object-cover" /> : <Store size={18} className="text-[#003366] dark:text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{shop.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-slate-500">
                        <span>{shop.totalListings} listing{shop.totalListings !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Link href={`/shop-dashboard/${shop.id}`}>
                        <button className="text-[11px] font-semibold bg-[#003366] dark:bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-[#002244] transition">Manage</button>
                      </Link>
                      <Link href={`/shop/${shop.slug}`}>
                        <button className="text-[11px] font-semibold border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition">View</button>
                      </Link>
                    </div>
                  </div>
                ))}
                <Link href="/create-shop">
                  <button className="w-full flex items-center justify-center gap-1.5 border border-dashed border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 text-xs font-semibold py-3 rounded-2xl hover:border-[#003366] hover:text-[#003366] dark:hover:border-blue-500 dark:hover:text-blue-400 transition">
                    <Plus size={12} /> Create New Shop
                  </button>
                </Link>
              </div>
            )}
          </div>

        </div>{/* /px-4 */}
      </div>

      {/* Modals */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-slate-100">{t.deleteConfirm}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate max-w-[200px]">{deleteTarget.title}</p>
              </div>
            </div>
            {deleteError && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 mb-3">
                {deleteError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(""); }}
                className="flex-1 min-h-[44px] border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                className="flex-1 min-h-[44px] bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {deleting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  </span>
                ) : t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
      {showHoldModal && (
        <ReportHoldModal action={holdModalAction} onClose={() => setShowHoldModal(false)} />
      )}
    </>
  );
}
