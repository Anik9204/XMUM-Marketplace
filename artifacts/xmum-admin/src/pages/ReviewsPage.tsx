import { useEffect, useState } from "react";
import {
  collection, query, orderBy, onSnapshot,
  deleteDoc, doc, getDocs, where, updateDoc, increment,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { AdminReview } from "../lib/types";
import { Trash2 } from "lucide-react";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? "text-amber-400" : "text-slate-200 dark:text-slate-600"}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminReview)));
        setLoading(false);
      },
      (err) => {
        console.error("[ReviewsPage] onSnapshot error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  async function handleDelete(review: AdminReview) {
    if (!window.confirm("Delete this review? This cannot be undone.")) return;

    setReviews((prev) => prev.filter((r) => r.id !== review.id));

    try {
      await deleteDoc(doc(db, "reviews", review.id));

      const remaining = await getDocs(
        query(collection(db, "reviews"), where("sellerId", "==", review.sellerId))
      );

      if (remaining.empty) {
        await updateDoc(doc(db, "users", review.sellerId), { rating: 0, totalReviews: 0 });
      } else {
        const total = remaining.docs.reduce((sum, d) => sum + (d.data().rating ?? 0), 0);
        const newAvg = Math.round((total / remaining.size) * 10) / 10;
        await updateDoc(doc(db, "users", review.sellerId), {
          rating: newAvg,
          totalReviews: increment(-1),
        });
      }
    } catch (err) {
      console.error("[ReviewsPage] delete failed:", err);
      alert("Failed to delete review. Check Firestore permissions.");
      const q2 = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q2);
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminReview)));
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">Reviews</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Moderate user-submitted seller reviews
          </p>
        </div>
        {!loading && (
          <span className="ml-auto bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300
                           text-xs font-semibold px-3 py-1 rounded-full">
            {reviews.length} total
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i}
                 className="h-24 bg-white dark:bg-slate-800 rounded-2xl animate-pulse
                            border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <span className="text-5xl mb-3">⭐</span>
          <p className="font-semibold text-slate-700 dark:text-slate-300">No reviews yet.</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Reviews submitted by students will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id}
                 className="bg-white dark:bg-slate-800 rounded-2xl p-5 border
                            border-gray-100 dark:border-slate-700">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Stars rating={review.rating} />
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {new Date(review.createdAt).toLocaleDateString("en-MY", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs mt-1">
                    <div>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {review.reviewerName || "Unknown"}
                      </span>
                      <span className="ml-1.5 text-slate-400 dark:text-slate-500 font-mono text-[10px]">
                        {review.reviewerId}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 mr-1">→</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {review.sellerName || "Unknown seller"}
                      </span>
                      <span className="ml-1.5 text-slate-400 dark:text-slate-500 font-mono text-[10px]">
                        {review.sellerId}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] italic text-slate-400 dark:text-slate-500 truncate">
                    Re: {review.listingTitle}
                  </p>

                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug
                                line-clamp-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2 mt-1">
                    "{review.comment}"
                  </p>
                </div>

                <button
                  onClick={() => handleDelete(review)}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs text-red-500
                             border border-red-200 dark:border-red-800 rounded-xl px-3 py-2
                             hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[36px]"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
