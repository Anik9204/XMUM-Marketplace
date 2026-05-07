import { useState, useEffect, useRef } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getUserListings, deleteListing, markAsSold } from "@/lib/listings";
import { Listing } from "@/lib/types";
import ListingCard from "@/components/ListingCard";
import AuthModal from "@/components/AuthModal";
import { User, CheckCircle, AlertCircle, LogOut, CheckCircle2, Settings } from "lucide-react";
import { logOut } from "@/lib/auth";
import { useLocation } from "wouter";

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

export default function ProfilePage() {
  const { t } = useLang();
  const { user, userProfile, avatarOverride } = useAuth();
  const [, navigate] = useLocation();

  const [showAuth, setShowAuth] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Cache listings in a ref so navigating Settings → Profile doesn't re-fetch on every visit.
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
        listingsCache.current = data;
        setListings(data);
      })
      .finally(() => setLoading(false));
  }, [user]);

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

  const handleMarkAsSold = async (listing: Listing) => {
    try {
      await markAsSold(listing.id);
      const updated = listingsCache.current.map((l) =>
        l.id === listing.id ? { ...l, status: "sold" as const } : l
      );
      listingsCache.current = updated;
      setListings(updated);
      setSuccessToast(t.markedAsSold);
    } catch {
      // silently ignore — surface via UI if needed
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
      <img src={avatarSrc} alt="avatar" className="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow" />
    ) : (
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#003366] to-[#0055aa] flex items-center justify-center text-white font-bold text-xl shadow">
        {(user.email ?? "?")[0].toUpperCase()}
      </div>
    );

  return (
    <>
      {successToast && <SuccessToast message={successToast} onDone={() => setSuccessToast("")} />}

      <div className="max-w-5xl mx-auto px-4 py-5 pb-24 sm:pb-8 animate-in fade-in duration-200">
        {/* Profile card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 mb-5 flex items-center gap-4">
          <AvatarDisplay />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{displayName}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{user.email}</p>
            <span className={`inline-flex items-center gap-1 text-xs font-medium mt-1 px-2 py-0.5 rounded-full ${user.emailVerified ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
              {user.emailVerified
                ? <><CheckCircle size={10} />{t.verifiedBadge}</>
                : <><AlertCircle size={10} />{t.unverifiedBadge}</>}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-red-500 border border-red-200 dark:border-red-800 px-3 min-h-[44px] py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
          >
            <LogOut size={14} />
            {t.signOut}
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 mb-5">
          <button
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 border-[#003366] dark:border-blue-400 text-[#003366] dark:text-blue-400 -mb-px"
          >
            {t.myListings}
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors -mb-px"
          >
            <Settings size={14} />
            {t.accountSettings}
          </button>
        </div>

        {/* Listings grid */}
        {loading ? (
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
        ) : listings.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-slate-400">
            <p className="text-sm">{t.noListings}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                showDelete
                showMarkSold
                showEdit
                onDelete={() => setDeleteTarget(l)}
                onMarkSold={() => handleMarkAsSold(l)}
                onEdit={() => navigate(`/edit/${l.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete listing confirmation modal */}
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
