import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getListingsByUser } from "@/lib/listings";
import { getProfile } from "@/lib/userProfile";
import { getOrCreateConversation } from "@/lib/messaging";
import { Listing, UserProfile } from "@/lib/types";
import ListingCard from "@/components/ListingCard";
import { CheckCircle2, MessageCircle, Settings, ArrowLeft, Loader2, ShoppingBag } from "lucide-react";

function memberDuration(createdAt: number): string {
  const diff = Date.now() - createdAt;
  const days = Math.floor(diff / 86400000);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);
  if (years > 0) return `${years} year${years === 1 ? "" : "s"} ago`;
  if (months > 0) return `${months} month${months === 1 ? "" : "s"} ago`;
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ago`;
  return "today";
}

function memberSince(createdAt: number): string {
  return new Date(createdAt).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

function StarRating({ rating }: { rating: number }) {
  const rounded = Math.round(Math.min(5, Math.max(0, rating ?? 0)));
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`text-lg leading-none ${
            i <= rounded
              ? "text-yellow-400"
              : "text-gray-200 dark:text-slate-600"
          }`}
        >
          ★
        </span>
      ))}
      <span className="ml-1.5 text-xs text-slate-500 dark:text-slate-400">
        {rating > 0 ? `${rating.toFixed(1)} / 5` : "No rating yet"}
      </span>
    </div>
  );
}

const SkeletonGrid = () => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
    {[...Array(4)].map((_, i) => (
      <div
        key={i}
        className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-pulse"
      >
        <div className="aspect-[4/3] bg-gray-100 dark:bg-slate-700" />
        <div className="p-3 space-y-2">
          <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-3/4" />
          <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

export default function SellerProfilePage() {
  const { user } = useAuth();
  const [, params] = useRoute("/seller/:uid");
  const [, navigate] = useLocation();

  const uid = params?.uid ?? "";
  const isOwnProfile = !!user && user.uid === uid;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    setNotFound(false);
    Promise.all([getProfile(uid), getListingsByUser(uid)])
      .then(([prof, lists]) => {
        if (!prof) {
          setNotFound(true);
          return;
        }
        setProfile(prof);
        setListings(lists);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [uid]);

  const handleMessage = async () => {
    if (!user || !profile) return;
    setChatError(null);
    setStartingChat(true);
    try {
      const convId = await getOrCreateConversation(user.uid, uid, {
        id: "profile",
        title: `Chat with ${profile.displayName || profile.fullName}`,
        photos: [],
      });
      navigate(`/messages?conv=${convId}`);
    } catch (err: any) {
      const code = err?.code ?? err?.message ?? "";
      if (code.includes("permission-denied") || code.includes("PERMISSION_DENIED")) {
        setChatError("Make sure your XMUM email is verified to send messages.");
      } else {
        setChatError("Could not open chat. Please try again.");
      }
    } finally {
      setStartingChat(false);
    }
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-card border border-gray-100 dark:border-slate-700 mb-6 animate-pulse">
          <div className="h-24 bg-gradient-to-br from-[#003366] to-[#0055aa]" />
          <div className="px-5 pb-6 -mt-10">
            <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-slate-600 border-4 border-white dark:border-slate-800 mb-3" />
            <div className="h-5 bg-gray-100 dark:bg-slate-700 rounded w-40 mb-2" />
            <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-28 mb-4" />
            <div className="h-px bg-gray-100 dark:bg-slate-700 mb-4" />
            <div className="flex gap-6">
              <div className="h-10 bg-gray-100 dark:bg-slate-700 rounded w-20" />
              <div className="h-10 bg-gray-100 dark:bg-slate-700 rounded w-28" />
            </div>
          </div>
        </div>
        <SkeletonGrid />
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (notFound || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <ShoppingBag size={52} className="text-gray-200 dark:text-slate-600 mb-4" />
        <p className="text-base font-semibold text-gray-600 dark:text-slate-300">Seller not found</p>
        <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
          This account may have been removed or doesn't exist.
        </p>
        <button
          onClick={() => window.history.back()}
          className="mt-5 text-sm text-[#003366] dark:text-blue-400 underline font-medium min-h-[44px]"
        >
          Go back
        </button>
      </div>
    );
  }

  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    profile.displayName || profile.fullName || "U"
  )}&background=003366&color=fff&size=128`;

  const displayName = profile.displayName || profile.fullName || profile.email?.split("@")[0] || "Seller";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24 sm:pb-8 animate-in fade-in duration-200">
      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 mb-4 min-h-[44px] transition-colors"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-card border border-gray-100 dark:border-slate-700 mb-6">
        {/* Gradient banner */}
        <div className="h-24 sm:h-32 bg-gradient-to-br from-[#003366] via-[#004488] to-[#0055aa]" />

        <div className="px-5 pb-5">
          {/* Avatar row + CTA button */}
          <div className="-mt-10 mb-3 flex items-end justify-between gap-3">
            <img
              src={profile.avatarUrl || avatarFallback}
              alt={displayName}
              className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-md shrink-0"
            />

            {isOwnProfile ? (
              <Link href="/settings">
                <button className="flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                  <Settings size={14} />
                  Edit Profile
                </button>
              </Link>
            ) : user ? (
              <button
                onClick={handleMessage}
                disabled={startingChat}
                className="flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#003366] dark:bg-blue-600 text-white text-sm font-semibold hover:bg-[#002244] dark:hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {startingChat
                  ? <Loader2 size={15} className="animate-spin" />
                  : <MessageCircle size={15} />}
                Message Seller
              </button>
            ) : (
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#003366] dark:bg-blue-600 text-white text-sm font-semibold hover:bg-[#002244] dark:hover:bg-blue-700 transition-colors shadow-sm"
              >
                <MessageCircle size={15} />
                Sign in to Message
              </button>
            )}
          </div>

          {chatError && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 mb-3">
              {chatError}
            </p>
          )}

          {/* Name + verified badge */}
          <div className="flex items-center flex-wrap gap-2 mb-0.5">
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
              {displayName}
            </h1>
            {profile.isVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={11} />
                XMUM Verified
              </span>
            )}
          </div>

          {/* Full name (if different from display name) */}
          {profile.fullName && profile.displayName && profile.displayName !== profile.fullName && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-0.5">{profile.fullName}</p>
          )}

          {/* Member since */}
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
            Seller since {memberSince(profile.createdAt)}
          </p>

          {/* Star rating */}
          <div className="mb-4">
            <StarRating rating={profile.rating ?? 0} />
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 pt-3 border-t border-gray-100 dark:border-slate-700">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                {listings.length}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Active listing{listings.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="w-px h-8 bg-gray-100 dark:bg-slate-700" />
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Member</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Joined {memberDuration(profile.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Listings grid ──────────────────────────────────────────────────── */}
      <h2 className="text-base font-bold text-gray-800 dark:text-slate-200 mb-3">
        What {displayName} is selling
      </h2>

      {listings.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <ShoppingBag size={52} className="text-gray-200 dark:text-slate-600 mb-3" />
          <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">
            No active listings yet
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-xs">
            {isOwnProfile
              ? "You haven't posted anything yet. Tap Post to get started."
              : `Check back later — ${displayName} may post something soon.`}
          </p>
          {isOwnProfile && (
            <Link href="/post">
              <button className="mt-4 bg-[#003366] dark:bg-blue-600 text-white px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold hover:bg-[#002244] dark:hover:bg-blue-700 transition-colors">
                Post a listing
              </button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
