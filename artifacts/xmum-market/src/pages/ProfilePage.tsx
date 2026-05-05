import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getUserListings, deleteListing } from "@/lib/listings";
import { Listing } from "@/lib/types";
import ListingCard from "@/components/ListingCard";
import AuthModal from "@/components/AuthModal";
import VerificationBanner from "@/components/VerificationBanner";
import { User, CheckCircle, AlertCircle, LogOut, CheckCircle2 } from "lucide-react";
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
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#003366] text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl transition-all duration-400 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"
      }`}
    >
      <CheckCircle2 size={18} className="text-green-300 shrink-0" />
      {message}
    </div>
  );
}

export default function ProfilePage() {
  const { t } = useLang();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getUserListings(user.uid)
      .then(setListings)
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <User size={48} className="text-gray-200 mb-4" />
        <p className="text-gray-600 font-medium mb-1">{t.loginToPost}</p>
        <button onClick={() => setShowAuth(true)} className="mt-3 bg-[#003366] text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
          {t.signIn}
        </button>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  const handleDelete = async (listing: Listing) => {
    setDeleting(true);
    try {
      await Promise.race([
        deleteListing(listing),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("timeout:delete")), 10_000)
        ),
      ]);
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      setDeleteTarget(null);
      setSuccessToast("Your post has been deleted successfully.");
    } catch (err: any) {
      if (err?.message === "timeout:delete") {
        // Firestore queued the delete locally and will sync when the server is reachable.
        // Treat as success so the UI doesn't hang.
        setListings((prev) => prev.filter((l) => l.id !== listing.id));
        setDeleteTarget(null);
        setSuccessToast("Your post has been deleted successfully.");
      } else {
        console.error("[ProfilePage] Delete failed:", err);
        setDeleteError("Failed to delete. Please try again.");
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleSignOut = async () => {
    await logOut();
    navigate("/");
  };

  return (
    <>
      {successToast && (
        <SuccessToast
          message={successToast}
          onDone={() => navigate("/profile")}
        />
      )}

      {user && !user.emailVerified && <VerificationBanner />}

      <div className="max-w-5xl mx-auto px-4 py-5">
        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#003366] to-[#0055aa] flex items-center justify-center text-white text-xl font-bold">
            {(user.email ?? "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {user.email?.split("@")[0]}
            </p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
            <span className={`inline-flex items-center gap-1 text-xs font-medium mt-1 px-2 py-0.5 rounded-full ${user.emailVerified ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
              {user.emailVerified ? (
                <><CheckCircle size={10} />{t.verifiedBadge}</>
              ) : (
                <><AlertCircle size={10} />{t.unverifiedBadge}</>
              )}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut size={14} />
            {t.signOut}
          </button>
        </div>

        {/* My listings */}
        <h2 className="text-base font-bold text-gray-800 mb-3">{t.myListings}</h2>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-44 bg-gray-100" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-2 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">{t.noListings}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                showDelete
                onDelete={() => setDeleteTarget(l)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <p className="font-semibold text-gray-800 mb-1">{t.deleteConfirm}</p>
            <p className="text-xs text-gray-500 mb-4 truncate">{deleteTarget.title}</p>
            {deleteError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
                {deleteError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(""); }}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {deleting ? "..." : t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
