import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { collection, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getListingsByUser } from "@/lib/listings";
import { getReviews, hasReviewed, leaveReview } from "@/lib/reviews";
import { useAuth } from "@/contexts/AuthContext";
import { UserProfile, Listing, Review } from "@/lib/types";
import ListingCard from "@/components/ListingCard";
import { CheckCircle2, Share2, MessageCircle, Loader2, Star, ArrowLeft, Store } from "lucide-react";
import { getOrCreateConversation } from "@/lib/messaging";
import { useToast } from "@/hooks/use-toast";

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const rounded = Math.round(Math.min(5, Math.max(0, rating ?? 0)));
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= rounded ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200 dark:fill-slate-600 dark:text-slate-600"}
        />
      ))}
    </span>
  );
}

function InteractiveStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="p-0.5"
        >
          <Star
            size={24}
            className={i <= (hover || value) ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200 dark:fill-slate-600 dark:text-slate-600"}
          />
        </button>
      ))}
    </div>
  );
}

function memberSince(ms: number): string {
  return new Date(ms).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

export default function ShopPage() {
  const { user } = useAuth();
  const [, params] = useRoute("/shop/:slug");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const slug = params?.slug ?? "";

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [chatError, setChatError] = useState("");

  // Review form
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const isOwner = !!user && user.uid === profile?.uid;

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    const q = query(collection(db, "users"), where("shopSlug", "==", slug), limit(1));
    getDocs(q)
      .then(async (snap) => {
        if (snap.empty) { setNotFound(true); return; }
        const data = snap.docs[0].data() as UserProfile;
        const prof = { ...data, uid: snap.docs[0].id };
        setProfile(prof);

        setListingsLoading(true);
        const [lists, revs] = await Promise.all([
          getListingsByUser(prof.uid).catch(() => []),
          getReviews(prof.uid).catch(() => []),
        ]);
        setListings(lists);
        setReviews(revs);

        if (user && user.uid !== prof.uid) {
          hasReviewed(user.uid, prof.uid).then(setAlreadyReviewed).catch(() => {});
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => { setLoading(false); setListingsLoading(false); });
  }, [slug, user?.uid]);

  const handleMessage = async () => {
    if (!user || !profile) return;
    setChatError("");
    setStartingChat(true);
    try {
      const convId = await getOrCreateConversation(user.uid, profile.uid, {
        id: "shop",
        title: `Chat with ${profile.shopName || profile.displayName}`,
        photos: [],
      });
      navigate(`/messages?conv=${convId}`);
    } catch (err: any) {
      const code = err?.code ?? err?.message ?? "";
      if (code.includes("permission-denied")) {
        setChatError("Make sure your XMUM email is verified to send messages.");
      } else {
        setChatError("Could not open chat. Please try again.");
      }
    } finally {
      setStartingChat(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const data = { title: profile?.shopName ?? "Shop on XMUM Market", url };
    if (navigator.share && navigator.canShare?.(data)) {
      try { await navigator.share(data); return; } catch (err: any) { if (err?.name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: url });
    } catch {
      toast({ title: "Copy failed", description: url, variant: "destructive" });
    }
  };

  const handleSubmitReview = async () => {
    if (!user || !profile || reviewRating === 0) { setReviewError("Please select a rating."); return; }
    if (!reviewComment.trim()) { setReviewError("Please write a short review."); return; }
    setSubmittingReview(true);
    setReviewError("");
    try {
      await leaveReview(profile.uid, {
        reviewerId: user.uid,
        reviewerName: user.email?.split("@")[0] ?? "Anonymous",
        reviewerAvatar: undefined,
        sellerId: profile.uid,
        listingId: "",
        listingTitle: profile.shopName ?? "",
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setAlreadyReviewed(true);
      setShowReviewForm(false);
      const newReview: Review = {
        id: Date.now().toString(),
        reviewerId: user.uid,
        reviewerName: user.email?.split("@")[0] ?? "Anonymous",
        sellerId: profile.uid,
        listingId: "",
        listingTitle: profile.shopName ?? "",
        rating: reviewRating,
        comment: reviewComment.trim(),
        createdAt: Date.now(),
      };
      setReviews((r) => [newReview, ...r]);
      toast({ title: "Review submitted!" });
    } catch (err: any) {
      setReviewError(err?.message ?? "Failed to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse">
        <div className="aspect-[3/1] bg-gray-200 dark:bg-slate-700" />
        <div className="px-4 py-4 space-y-3">
          <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
          <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-1/3" />
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Store size={52} className="text-gray-200 dark:text-slate-600 mb-4" />
        <p className="text-base font-semibold text-gray-600 dark:text-slate-300">This shop doesn't exist or has been removed.</p>
        <button onClick={() => window.history.back()} className="mt-4 text-sm text-[#003366] dark:text-blue-400 underline min-h-[44px]">
          Go back
        </button>
      </div>
    );
  }

  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.shopName || profile.displayName || "S")}&background=003366&color=fff&size=128`;
  const displayName = profile.displayName || profile.fullName || profile.email?.split("@")[0] || "Seller";

  return (
    <div className="max-w-3xl mx-auto pb-24 sm:pb-8 animate-in fade-in duration-200">
      {/* Back button */}
      <div className="px-4 pt-4">
        <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 mb-3 min-h-[44px] transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      {/* ── Banner ──────────────────────────────────────────────────────────── */}
      {profile.shopBannerUrl ? (
        <img src={profile.shopBannerUrl} alt="Shop banner" className="w-full aspect-[3/1] object-cover" />
      ) : (
        <div className="w-full aspect-[3/1] bg-gradient-to-br from-[#003366] to-[#0055CC]" />
      )}

      {/* ── Shop Info Card ─────────────────────────────────────────────────── */}
      <div className="mx-4 -mt-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-4 mb-5">
        <div className="flex items-end gap-3 -mt-10 mb-3">
          <img
            src={profile.avatarUrl || avatarFallback}
            alt={displayName}
            className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-md shrink-0"
          />
          <div className="pb-1 flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-tight truncate">
              {profile.shopName || displayName}
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 italic">by {displayName}</p>
          </div>
        </div>

        {profile.verificationStatus === "approved" && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-1 rounded-full mb-3">
            <CheckCircle2 size={13} /> Verified XMUM Shop
          </span>
        )}

        {profile.rating != null && profile.rating > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <StarRating rating={profile.rating} />
            <span className="text-xs text-gray-500 dark:text-slate-400">{profile.rating.toFixed(1)} ({reviews.length} reviews)</span>
          </div>
        )}

        {profile.shopBio && (
          <p className="text-sm text-gray-600 dark:text-slate-300 mb-3 leading-relaxed">{profile.shopBio}</p>
        )}

        {profile.shopCategories && profile.shopCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {profile.shopCategories.map((cat) => (
              <span key={cat} className="text-[11px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full font-medium">{cat}</span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400 border-t border-gray-100 dark:border-slate-700 pt-3 mb-4">
          <span><strong className="text-gray-800 dark:text-slate-200">{listings.length}</strong> listings</span>
          <span className="w-px h-4 bg-gray-200 dark:bg-slate-600" />
          <span>Member {memberSince(profile.createdAt)}</span>
          <span className="w-px h-4 bg-gray-200 dark:bg-slate-600" />
          <span><strong className="text-gray-800 dark:text-slate-200">{reviews.length}</strong> reviews</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {isOwner ? (
            <Link href="/settings#shop-verification" className="flex-1 min-h-[44px] flex items-center justify-center border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors gap-2">
              Edit Shop
            </Link>
          ) : (
            <>
              {user && user.emailVerified && (
                <button
                  onClick={handleMessage}
                  disabled={startingChat}
                  className="flex-1 min-h-[44px] bg-[#003366] dark:bg-blue-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#002244] dark:hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {startingChat ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                  Message
                </button>
              )}
              <button
                onClick={handleShare}
                className="min-h-[44px] px-4 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Share2 size={14} /> Share
              </button>
            </>
          )}
        </div>
        {chatError && <p className="text-xs text-red-500 mt-2">{chatError}</p>}
      </div>

      {/* ── Listings ─────────────────────────────────────────────────────────── */}
      <div className="px-4 mb-6">
        <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-3">
          {isOwner ? "Our Listings" : `Listings from ${profile.shopName || displayName}`}
        </h2>
        {listingsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden animate-pulse border border-gray-100 dark:border-slate-700">
                <div className="aspect-[4/3] bg-gray-100 dark:bg-slate-700" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">
            No active listings yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} sellerVerified={profile.verificationStatus === "approved"} />
            ))}
          </div>
        )}
      </div>

      {/* ── Reviews ──────────────────────────────────────────────────────────── */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">Reviews</h2>
          {user && !isOwner && !alreadyReviewed && user.emailVerified && (
            <button
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="text-xs text-[#003366] dark:text-blue-400 border border-[#003366]/30 dark:border-blue-500/30 px-3 py-1.5 rounded-lg hover:bg-[#003366]/5 dark:hover:bg-blue-500/10 transition-colors min-h-[36px]"
            >
              Leave a Review
            </button>
          )}
        </div>

        {showReviewForm && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 mb-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">Your Review</h3>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Rating *</p>
              <InteractiveStars value={reviewRating} onChange={setReviewRating} />
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value.slice(0, 300))}
              placeholder="Share your experience with this seller…"
              className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
              rows={3}
            />
            <p className="text-right text-[10px] text-gray-400">{reviewComment.length}/300</p>
            {reviewError && <p className="text-xs text-red-500">{reviewError}</p>}
            <button
              onClick={handleSubmitReview}
              disabled={submittingReview}
              className="w-full min-h-[44px] bg-[#003366] dark:bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#002244] transition-colors"
            >
              {submittingReview ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : "Submit Review"}
            </button>
          </div>
        )}

        {alreadyReviewed && (
          <p className="text-xs text-green-600 dark:text-green-400 mb-3 flex items-center gap-1">
            <CheckCircle2 size={12} /> You've already reviewed this seller.
          </p>
        )}

        {reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm">No reviews yet.</div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">@{r.reviewerName}</span>
                  <StarRating rating={r.rating} size={12} />
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-300">{r.comment}</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">{new Date(r.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
