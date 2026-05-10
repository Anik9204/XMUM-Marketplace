import { useState, useEffect, useRef } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getUserListings, deleteListing, markAsSold, bumpListing, getListing, LISTING_EXPIRY_MS, LISTING_REMINDER_MS, BUMP_COOLDOWN_MS } from "@/lib/listings";
import { getUserConversations } from "@/lib/messaging";
import { sendDailyDigestIfDue } from "@/lib/notifications";
import { Listing } from "@/lib/types";
import { getSavedListings } from "@/lib/savedListings";
import ListingCard from "@/components/ListingCard";
import AuthModal from "@/components/AuthModal";
import { User, CheckCircle, AlertCircle, LogOut, CheckCircle2, Settings, Clock, X, ArrowUp, Bookmark } from "lucide-react";
import { logOut } from "@/lib/auth";
import { useLocation } from "wouter";
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
      <CheckCircle2 size={18} className="text-green-300 shrink-0" />
      {message}
    </div>
  );
}

type ListingTab = "active" | "sold" | "archived" | "saved";

export default function ProfilePage() {
  const { t, lang } = useLang();
  const { user, userProfile, avatarOverride } = useAuth();
  const [, navigate] = useLocation();

  const [showAuth, setShowAuth] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [expiryReminders, setExpiryReminders] = useState<Listing[]>([]);
  const [tab, setTab] = useState<ListingTab>("active");

  const [savedListings, setSavedListings] = useState<Listing[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);

  const listingsCache = useRef<Listing[]>([]);

  useEffect(() => {
    if (!user) return;
    if (listingsCache.current.length > 0) {
      setListings(listingsCache.current);
      return;
    }
    setLoading(true);
    getUserListings(user.uid)
      .then((data) => {
        const now = Date.now();
        const expired = data.filter(l => now - l.createdAt >= LISTING_EXPIRY_MS && l.status === "active");
        const active = data.filter(l => !(now - l.createdAt >= LISTING_EXPIRY_MS && l.status === "active"));

        if (expired.length > 0) {
          Promise.allSettled(expired.map(l => deleteListing(l))).then(() => {
            if (expired.length === 1) {
              setSuccessToast(`"${expired[0].title}" has been automatically removed after 30 days.`);
            } else {
              setSuccessToast(`${expired.length} listings have been automatically removed after 30 days.`);
            }
            expired.forEach(l => {
              addNotification(user.uid, {
                type: "listing_deleted",
                title: "Listing Removed",
                body: `"${l.title}" was automatically removed after 30 days.`,
                listingId: l.id,
              });
            });
          });
        }

        listingsCache.current = active;
        setListings(active);
        sendDailyDigestIfDue(user.uid, active);
        getUserConversations(user.uid).then(convs => {
          const msgs = convs.reduce((sum, c) => sum + (c.unreadCount?.[user.uid] ?? 0), 0);
          setTotalMessages(msgs);
        }).catch(() => {});

        const expiringSoon = active.filter(
          l => l.status === "active" &&
          now - l.createdAt >= LISTING_REMINDER_MS &&
          now - l.createdAt < LISTING_EXPIRY_MS
        );
        if (expiringSoon.length > 0) setExpiryReminders(expiringSoon);
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (tab !== "saved" || !user) return;
    setSavedLoading(true);
    getSavedListings(user.uid)
      .then(async (saved) => {
        const results = await Promise.all(saved.map(s => getListing(s.listingId).catch(() => null)));
        setSavedListings(results.filter((l): l is Listing => l !== null));
      })
      .catch(() => {})
      .finally(() => setSavedLoading(false));
  }, [tab, user?.uid]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <User size={48} className="text-gray-200 dark:text-slate-600 mb-4" />
        <p className="text-gray-600 dark:text-slate-300 font-medium mb-1">{t.loginToPost}</p>
        <button
          onClick={() => setShowAuth(true)}
          className="mt-3 bg-[#003366] dark:bg-blue-600 text-white px-5 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold"
        >
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
      await deleteListing(listing);
      const updated = listingsCache.current.filter((l) => l.id !== listing.id);
      listingsCache.current = updated;
      setListings(updated);
      setDeleteTarget(null);
      setSuccessToast("Your post has been deleted successfully.");
    } catch (err: any) {
      const code: string = err?.code ?? "";
      if (code === "permission-denied" || code === "storage/unauthorized") {
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

  const handleBump = async (listing: Listing) => {
    if (listing.status === "sold") return;
    try {
      const result = await bumpListing(listing.id);
      if (result.success) {
        const now = Date.now();
        setSuccessToast(`"${listing.title}" has been bumped to the top!`);
        const updated = (prev: Listing[]) => {
          const bumped = prev.find(l => l.id === listing.id);
          if (!bumped) return prev;
          const rest = prev.filter(l => l.id !== listing.id);
          return [{ ...bumped, lastBumpedAt: now, sortKey: now }, ...rest];
        };
        setListings(updated);
        listingsCache.current = updated(listingsCache.current);
      } else {
        const hours = Math.ceil((result.nextBumpAt - Date.now()) / 3_600_000);
        setSuccessToast(`You can bump "${listing.title}" again in ${hours} hour${hours === 1 ? "" : "s"}.`);
      }
    } catch {
      setSuccessToast("Bump failed — please check your connection.");
    }
  };

  const handleMarkAsSold = async (listing: Listing) => {
    try {
      await markAsSold(listing.id);
      const updated = listingsCache.current.map((l) =>
        l.id === listing.id ? { ...l, status: "sold" as const } : l
      );
      listingsCache.current = updated;
      setListings(updated);
      setSuccessToast(t.markedAsSold);
      addNotification(user.uid, {
        type: "listing_sold",
        title: listing.type === "lost-found" ? "Item Resolved" : "Item Marked as Sold",
        body: `"${listing.title}" has been marked as ${listing.type === "lost-found" ? "resolved" : "sold"}.`,
        listingId: listing.id,
      });
    } catch {
      // silently ignore
    }
  };

  const handleSignOut = async () => {
    await logOut();
    navigate("/");
  };

  const avatarSrc = avatarOverride ?? userProfile?.avatarUrl ?? "";
  const displayName = userProfile?.fullName || user.email?.split("@")[0] || "";

  const AvatarDisplay = () =>
    avatarSrc ? (
      <img src={avatarSrc} alt="avatar" className="w-16 h-16 rounded-full object-cover border-4 border-white dark:border-slate-700 shadow-sm" />
    ) : (
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#003366] to-[#0055aa] flex items-center justify-center text-white font-bold text-xl shadow">
        {(user.email ?? "?")[0].toUpperCase()}
      </div>
    );

  const now = Date.now();
  const filteredListings = listings.filter(l => {
    if (tab === "active") return !l.isArchived && l.status !== "sold";
    if (tab === "sold") return l.status === "sold";
    if (tab === "archived") return l.isArchived;
    return true;
  });

  const isGridLoading = tab === "saved" ? savedLoading : loading;
  const gridListings = tab === "saved" ? savedListings : filteredListings;

  // Stats
  const activeCount = listings.filter(l => !l.isArchived && l.status !== "sold").length;
  const soldCount = listings.filter(l => l.status === "sold").length;
  const archivedCount = listings.filter(l => l.isArchived && l.status !== "sold").length;
  const viewCount = listings.reduce((sum, l) => sum + (l.viewCount ?? 0), 0);
  const savedCount = savedListings.length;

  const subTabs: { key: ListingTab; label: string; count: number }[] = [
    { key: "active",   label: "Active",   count: activeCount },
    { key: "sold",     label: "Sold",     count: soldCount },
    { key: "archived", label: "Archived", count: archivedCount },
    { key: "saved",    label: "Saved",    count: savedCount },
  ];

  return (
    <>
      {successToast && <SuccessToast message={successToast} onDone={() => setSuccessToast("")} />}

      <div className="max-w-5xl mx-auto px-4 py-5 pb-24 sm:pb-8 animate-in fade-in duration-200">

        {/* Profile header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-card mb-4">
          <div className="flex items-start gap-4">
            <AvatarDisplay />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{displayName}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Member since {userProfile ? new Date(userProfile.createdAt).toLocaleDateString("en-MY", { month: "short", year: "numeric" }) : "—"}
                </span>
                <span className="w-1 h-1 bg-slate-400 rounded-full shrink-0" />
                {user.emailVerified ? (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                    <CheckCircle size={10} /> XMUM Verified
                  </span>
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                    <AlertCircle size={10} /> Unverified
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs text-red-500 border border-red-200 dark:border-red-800 px-3 min-h-[44px] py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
            >
              <LogOut size={14} />
              {t.signOut}
            </button>
          </div>

          {/* Stats row */}
          <div className="mt-4 grid grid-cols-5 divide-x divide-gray-100 dark:divide-slate-700 border-t border-gray-100 dark:border-slate-700 pt-4">
            <div className="text-center px-1">
              <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{activeCount}</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500">Active</p>
            </div>
            <div className="text-center px-1">
              <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{soldCount}</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500">Sold</p>
            </div>
            <div className="text-center px-1">
              <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{viewCount}</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500">Views</p>
            </div>
            <div className="text-center px-1">
              <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{totalMessages}</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500">Messages</p>
            </div>
            <button
              className="text-center px-1 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors"
              onClick={() => setTab("saved")}
            >
              <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{savedCount}</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500">Saved</p>
            </button>
          </div>

        </div>

        {/* Tab bar — My Listings / Settings */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 mb-4">
          <button
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 border-[#003366] dark:border-blue-400 text-[#003366] dark:text-blue-400 -mb-px min-h-[44px]"
          >
            {t.myListings}
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors -mb-px min-h-[44px]"
          >
            <Settings size={14} />
            {t.accountSettings}
          </button>
        </div>

        {/* Listing sub-tabs */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl p-1 mb-4 overflow-x-auto scrollbar-hide">
          {subTabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-shrink-0 flex-1 min-w-[72px] rounded-lg py-2 text-xs font-medium min-h-[40px] transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${
                tab === key
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {key === "saved" && <Bookmark size={11} />}
              {loading ? label : `${label} (${count})`}
            </button>
          ))}
        </div>

        {/* Expiry reminder banner */}
        {tab !== "saved" && expiryReminders.length > 0 && (
          <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 flex items-start gap-3">
            <Clock size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {t.listingExpiryReminderTitle}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {expiryReminders.length === 1
                  ? `"${expiryReminders[0].title}" ${t.listingExpiryReminderBody}`
                  : `${expiryReminders.length} ${t.listingExpiryReminderBodyMultiple}`}
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {expiryReminders.map(l => {
                  const daysLeft = Math.ceil((l.createdAt + LISTING_EXPIRY_MS - now) / (1000 * 60 * 60 * 24));
                  return (
                    <li key={l.id} className="text-xs text-amber-700 dark:text-amber-400 truncate">
                      • {l.title} — {daysLeft} {t.daysLeft}
                    </li>
                  );
                })}
              </ul>
            </div>
            <button onClick={() => setExpiryReminders([])} className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Listings grid */}
        {isGridLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-gray-100 dark:bg-slate-700" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : gridListings.length === 0 ? (
          tab === "saved" ? (
            <div className="flex flex-col items-center py-14 text-center">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="text-gray-200 dark:text-slate-600 mb-4">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">No saved listings yet</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-xs">
                Tap the bookmark icon on any listing to save it for later.
              </p>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 dark:text-slate-400">
              <p className="text-sm">{tab === "active" ? t.noListings : `No ${tab} listings.`}</p>
            </div>
          )
        ) : tab === "saved" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredListings.map((l) => {
              const expiringSoon = l.status === "active" && now - l.createdAt >= LISTING_REMINDER_MS && now - l.createdAt < LISTING_EXPIRY_MS;
              return (
                <div key={l.id} className="flex flex-col gap-1">
                  <ListingCard
                    listing={l}
                    showDelete
                    showMarkSold
                    showEdit
                    onDelete={() => setDeleteTarget(l)}
                    onMarkSold={() => handleMarkAsSold(l)}
                    onEdit={() => navigate(`/edit/${l.id}`)}
                  />
                  {expiringSoon && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded-lg px-2 py-1">
                      ⚠️ Expires soon — Bump to refresh
                    </div>
                  )}
                  {l.status !== "sold" && (() => {
                    const onCooldown = !!l.lastBumpedAt && Date.now() - l.lastBumpedAt < BUMP_COOLDOWN_MS;
                    const hoursSince = l.lastBumpedAt
                      ? Math.floor((Date.now() - l.lastBumpedAt) / 3_600_000)
                      : null;
                    return (
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => handleBump(l)}
                          disabled={onCooldown}
                          title={lang === "en" ? "Move to top of feed (once per 24h)" : "置顶帖子（每24小时一次）"}
                          className={`text-xs border rounded-lg py-1.5 w-full min-h-[44px] flex items-center justify-center gap-1.5 transition-colors ${
                            onCooldown
                              ? "text-gray-400 border-gray-200 dark:border-slate-700 cursor-not-allowed opacity-60"
                              : "text-purple-600 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          }`}
                        >
                          <ArrowUp size={13} />
                          {onCooldown
                            ? (lang === "en"
                                ? `Bumped ${hoursSince}h ago`
                                : `${hoursSince} 小时前已置顶`)
                            : (lang === "en" ? "Bump to Top" : "置顶")}
                        </button>
                        <p className="text-[10px] text-center text-slate-400 dark:text-slate-500">
                          {lang === "en" ? "Move to top of feed (once per 24h)" : "置顶帖子（每24小时一次）"}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm">
            <p className="font-semibold text-gray-800 dark:text-slate-100 mb-1">{t.deleteConfirm}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4 truncate">{deleteTarget.title}</p>
            {deleteError && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 mb-3">
                {deleteError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(""); }}
                className="flex-1 min-h-[44px] border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 py-2.5 rounded-xl text-sm font-medium"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                className="flex-1 min-h-[44px] bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {deleting ? "…" : t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
