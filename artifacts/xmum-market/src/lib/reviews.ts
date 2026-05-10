import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  doc,
  getDoc,
  increment,
} from "firebase/firestore";
import { db } from "./firebase";
import { Review } from "./types";

export async function leaveReview(
  sellerId: string,
  review: Omit<Review, "id" | "createdAt">
): Promise<void> {
  await addDoc(collection(db, "reviews"), {
    ...review,
    createdAt: Date.now(),
  });
  const sellerRef = doc(db, "users", sellerId);
  const sellerSnap = await getDoc(sellerRef);
  const data = sellerSnap.data();
  const currentRating = data?.rating ?? 0;
  const totalReviews = data?.totalReviews ?? 0;
  const newRating = (currentRating * totalReviews + review.rating) / (totalReviews + 1);
  await updateDoc(sellerRef, {
    rating: Math.round(newRating * 10) / 10,
    totalReviews: increment(1),
  });
}

export async function getReviews(sellerId: string, count = 20): Promise<Review[]> {
  const q = query(
    collection(db, "reviews"),
    where("sellerId", "==", sellerId),
    orderBy("createdAt", "desc"),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review));
}

export async function hasReviewed(reviewerId: string, sellerId: string): Promise<boolean> {
  const q = query(
    collection(db, "reviews"),
    where("reviewerId", "==", reviewerId),
    where("sellerId", "==", sellerId),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
