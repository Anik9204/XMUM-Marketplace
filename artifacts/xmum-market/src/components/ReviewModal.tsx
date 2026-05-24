import { useState } from "react";
import { Star, X, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { leaveShopReview } from "@/lib/shops";
import { ShopOrder } from "@/lib/types";
import { moderateContent } from "@/lib/aiModerate";

interface ReviewModalProps {
  order: ShopOrder;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ReviewModal({ order, onClose, onSubmitted }: ReviewModalProps) {
  const { user, userProfile } = useAuth();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (order.reviewLeft) {
    return (
      <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">Already Reviewed</h3>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">You've already reviewed this order.</p>
          <button onClick={onClose} className="mt-4 w-full min-h-[44px] border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition">
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0 || submitting) return;
    setError("");
    // Only check if comment has meaningful content (reviews are optional text)
    if (comment.trim().length > 10) {
      const aiResult = await moderateContent(comment, "review");
      if (aiResult.result === "BLOCKED") {
        setError(aiResult.suggestion ? `${aiResult.reason} ${aiResult.suggestion}` : (aiResult.reason || "Review content flagged. Please keep it respectful."));
        return;
      }
    }
    setSubmitting(true);
    try {
      await leaveShopReview({
        shopId: order.shopId,
        shopListingId: order.shopListingId ?? order.listingId,
        inquiryId: order.id,
        reviewerId: user!.uid,
        reviewerName: userProfile?.fullName || user?.email?.split("@")[0] || "Student",
        reviewerAvatar: userProfile?.avatarUrl,
        listingTitle: order.listingTitle,
        rating,
        comment: comment.trim(),
      });
      onSubmitted();
    } catch (err: any) {
      setError(err.message ?? "Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hovered || rating;

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">Rate your experience</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">
          for: <span className="font-semibold text-gray-600 dark:text-slate-300">{order.listingTitle}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">Rating</p>
            <div className="flex gap-1.5" onMouseLeave={() => setHovered(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHovered(n)}
                  onClick={() => setRating(n)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    size={32}
                    className={n <= displayRating ? "text-amber-400 fill-amber-400" : "text-gray-200 dark:text-slate-600"}
                  />
                </button>
              ))}
            </div>
            {displayRating > 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                {["", "Poor", "Fair", "Good", "Very good", "Excellent"][displayRating]}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              Comment <span className="font-normal text-gray-400">(optional)</span>
            </p>
            <textarea
              rows={3}
              maxLength={400}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience… (optional)"
              className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
            />
            <p className="text-right text-[10px] text-gray-300 dark:text-slate-600 mt-0.5">{comment.length}/400</p>
          </div>

          {error && (
            <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={rating === 0 || submitting}
              className="flex-1 min-h-[44px] bg-[#003366] dark:bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-[#002244] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                "Submit Review"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
