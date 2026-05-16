import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  collection, query, orderBy, limit, getDocs,
  where, doc, updateDoc, deleteDoc, getDoc,
  onSnapshot, addDoc, serverTimestamp,
} from "firebase/firestore";
import { ShopAd } from "./types";
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

// ── Audit log ────────────────────────────────────────────────────────────────

export interface AuditEntry {
  actorUid: string;
  actorEmail: string;
  action: string;
  label: string;
  targetId: string;
  targetType: "listing" | "user" | "shop" | "report" | "shopAd";
  targetLabel: string;
  createdAt: number;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await addDoc(collection(db, "adminAuditLogs"), entry);
  } catch (err) {
    // Audit logging is non-critical — never let it break the main action
    console.warn("[writeAuditLog] failed (non-critical):", err);
  }
}

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

export function subscribePendingShopAds(
  callback: (ads: ShopAd[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, "shopAds"),
    where("status", "==", "pending"),
    orderBy("submittedAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopAd))),
    (err) => {
      console.error("[subscribePendingShopAds] error:", err);
      onError?.(err);
    },
  );
}

export function subscribeAllShopAds(
  callback: (ads: ShopAd[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, "shopAds"),
    orderBy("submittedAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopAd))),
    (err) => {
      console.error("[subscribeAllShopAds] error:", err);
      onError?.(err);
    },
  );
}

async function sendNotification(
  uid: string,
  data: { type: string; title: string; body: string; shopId: string },
): Promise<void> {
  try {
    await addDoc(collection(db, "users", uid, "notifications"), {
      ...data,
      createdAt: serverTimestamp(),
      read: false,
    });
  } catch (err) {
    console.warn("[sendNotification] failed (non-critical):", err);
  }
}

export async function notifyShopAdApproved(
  shopOwnerId: string,
  shopName: string,
  shopId: string,
): Promise<void> {
  await sendNotification(shopOwnerId, {
    type: "shop_ad_approved",
    title: "Shop ad approved",
    body: `Your ad for "${shopName}" has been approved and will be displayed in Campus Market.`,
    shopId,
  });
}

export async function notifyShopAdRejected(
  shopOwnerId: string,
  shopName: string,
  adminNote: string,
  shopId: string,
): Promise<void> {
  await sendNotification(shopOwnerId, {
    type: "shop_ad_rejected",
    title: "Shop ad rejected",
    body: adminNote
      ? `Your ad for "${shopName}" was rejected: ${adminNote}`
      : `Your ad for "${shopName}" was not approved. Please review and resubmit.`,
    shopId,
  });
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

function storagePathFromUrl(url: string): string | null {
  try {
    const decodedUrl = decodeURIComponent(url);
    const match = decodedUrl.match(/\/o\/(.+?)(\?|$)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function deleteShop(shopId: string) {
  const { writeBatch } = await import("firebase/firestore");
  const { ref: storageRef, deleteObject } = await import("firebase/storage");

  const shopSnap = await getDoc(doc(db, "shops", shopId));
  if (!shopSnap.exists()) throw new Error("Shop not found");

  const relatedCollections = ["shopListings", "shopInquiries", "shopOrders", "shopReviews"];

  // Fetch all related docs in parallel
  const snaps = await Promise.all(
    relatedCollections.map((col) =>
      getDocs(query(collection(db, col), where("shopId", "==", shopId))).catch(() => null)
    )
  );

  // Delete Storage files — listing photos
  const storageJobs: Promise<void>[] = [];
  const listingsSnap = snaps[0];
  if (listingsSnap) {
    for (const d of listingsSnap.docs) {
      for (const url of (d.data().photos ?? []) as string[]) {
        const path = storagePathFromUrl(url);
        if (path) storageJobs.push(deleteObject(storageRef(storage, path)).catch(() => {}));
      }
    }
  }

  // Delete Storage files — shop banner and logo
  const sd = shopSnap.data();
  for (const url of [sd.bannerUrl, sd.logoUrl].filter(Boolean) as string[]) {
    const path = storagePathFromUrl(url);
    if (path) storageJobs.push(deleteObject(storageRef(storage, path)).catch(() => {}));
  }
  await Promise.allSettled(storageJobs);

  // Batch-delete all Firestore documents (max 400 per batch)
  const allDocs = snaps.flatMap((s) => s?.docs ?? []);
  const BATCH_SIZE = 400;
  for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const d of allDocs.slice(i, i + BATCH_SIZE)) batch.delete(d.ref);
    await batch.commit();
  }

  // Delete the shop document last
  await deleteDoc(doc(db, "shops", shopId));
}
