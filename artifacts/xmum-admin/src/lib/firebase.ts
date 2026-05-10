import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  collection, query, orderBy, limit, getDocs,
  where, doc, updateDoc, deleteDoc, getDoc,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
// experimentalAutoDetectLongPolling bypasses Replit's WebSocket proxy block.
// This MUST use initializeFirestore — do not change to getFirestore().
export const db      = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
export const storage = getStorage(app);

// ── Campus Market helpers ────────────────────────────────────────────────────

export async function getShops(limitCount = 100) {
  const q = query(
    collection(db, "shops"),
    orderBy("createdAt", "desc"),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      shopName:          data.name          ?? data.shopName ?? "",
      shopSlug:          data.slug          ?? data.shopSlug ?? "",
      shopBio:           data.bio           ?? data.shopBio  ?? "",
      shopCategories:    data.category
                           ? [data.category]
                           : (data.shopCategories ?? []),
      shopBannerUrl:     data.bannerUrl     ?? data.shopBannerUrl ?? "",
      ownerEmail:        data.ownerEmail    ?? "",
      ownerUid:          data.ownerId       ?? data.ownerUid ?? "",
      activeListingCount: data.totalListings ?? data.activeListingCount ?? 0,
      inquiryCount:      data.totalInquiries ?? data.inquiryCount ?? 0,
      rating:            data.rating        ?? null,
      totalReviews:      data.reviewCount   ?? data.totalReviews ?? 0,
      createdAt:         data.createdAt     ?? 0,
    };
  });
}

export async function getPendingShopAds() {
  const q = query(
    collection(db, "shopAds"),
    where("status", "==", "pending"),
    orderBy("submittedAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAllShopAds() {
  const q = query(
    collection(db, "shopAds"),
    orderBy("submittedAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function approveShopAd(adId: string, reviewedBy: string) {
  await updateDoc(doc(db, "shopAds", adId), {
    status: "approved",
    reviewedBy,
    reviewedAt: Date.now(),
  });
}

export async function rejectShopAd(
  adId: string,
  reviewedBy: string,
  note: string,
) {
  await updateDoc(doc(db, "shopAds", adId), {
    status: "rejected",
    reviewedBy,
    reviewedAt: Date.now(),
    adminNote: note,
  });
}

export async function getShopInquiries(shopId: string) {
  const q = query(
    collection(db, "shopInquiries"),
    where("shopId", "==", shopId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteShop(shopId: string) {
  // Fetch shop doc first to get ownerUid for cleanup if needed
  const shopSnap = await getDoc(doc(db, "shops", shopId));
  if (!shopSnap.exists()) throw new Error("Shop not found");
  await deleteDoc(doc(db, "shops", shopId));
}
