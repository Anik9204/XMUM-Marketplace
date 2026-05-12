import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  QueryDocumentSnapshot,
  getCountFromServer,
  increment,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "./firebase";
import { Listing, ListingType } from "./types";
import { sanitizeListingData } from "./sanitize";

// ── REQUIRED FIRESTORE COMPOSITE INDEXES ─────────────────────────
// Deploy these via Firebase Console → Firestore → Indexes:
//
// 1. listings: type ASC, sortKey DESC
//    (used by getListingsPage)
//
// 2. listings: type ASC, category ASC, sortKey DESC
//    (used by getListingsPage with category filter)
//
// 3. listings: userId ASC, createdAt DESC
//    (used by getUserListings)
//
// 4. listings: type ASC, isArchived ASC, status ASC
//    (used by getTabCounts)
//
// 5. reviews: sellerId ASC, createdAt DESC
//    (used by getReviews in reviews.ts)
//
// 6. sellerTcAuditLogs: userId ASC, acceptedAt DESC
//    (admin query)
// ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;

const CACHE_TTL_MS = 60_000;

/**
 * Maximum listing price in cents (RM 1,000,000.00).
 * JS numbers are 64-bit floats safe up to 2^53 — 100_000_000 is well within range.
 */
export const MAX_PRICE_CENTS = 100_000_000;

function getCacheKey(type: string, cursor: string | null): string {
  return `listings_cache_${type}_${cursor ?? "first"}`;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data as T;
  } catch { return null; }
}

function writeCache<T>(key: string, data: T): void {
  try {
    // Evict oldest half when the cache grows beyond 20 slots to prevent
    // sessionStorage (typically 5–10 MB) from filling up across many page/cursor combinations.
    const allKeys = Object.keys(sessionStorage).filter((k) => k.startsWith("listings_cache_"));
    if (allKeys.length >= 20) {
      const sorted = allKeys.sort((a, b) => {
        try {
          const ta = (JSON.parse(sessionStorage.getItem(a) ?? "{}") as { ts?: number }).ts ?? 0;
          const tb = (JSON.parse(sessionStorage.getItem(b) ?? "{}") as { ts?: number }).ts ?? 0;
          return ta - tb;
        } catch { return 0; }
      });
      sorted.slice(0, Math.ceil(allKeys.length / 2)).forEach((k) => sessionStorage.removeItem(k));
    }
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export const LISTING_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
export const LISTING_REMINDER_MS = 23 * 24 * 60 * 60 * 1000;

function toMillis(val: unknown): number {
  if (typeof val === "number") return val;
  if (val && typeof (val as any).toMillis === "function") return (val as any).toMillis();
  return Date.now();
}

function mapDoc(d: QueryDocumentSnapshot): Listing {
  const data = d.data();
  const createdAt = toMillis(data.createdAt);
  return {
    id: d.id,
    ...data,
    createdAt,
    sortKey: data.sortKey ?? createdAt,
  } as Listing;
}

function storagePathFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/o\/(.+?)(\?|$)/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export async function uploadPhoto(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const storageRef = ref(storage, `listings/${userId}/${Date.now()}.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function getTabCounts(): Promise<Partial<Record<ListingType, number>>> {
  const types: ListingType[] = ["buy-sell", "lost-found", "jobs", "assistance", "rental"];
  try {
    const counts = await Promise.all(
      types.map(async (type) => {
        try {
          const q = query(collection(db, "listings"), where("type", "==", type));
          const snap = await getCountFromServer(q);
          return snap.data().count;
        } catch {
          return 0;
        }
      })
    );
    return Object.fromEntries(types.map((t, i) => [t, counts[i]])) as Record<ListingType, number>;
  } catch {
    return {};
  }
}

export async function createListing(
  data: Omit<Listing, "id" | "createdAt" | "isArchived" | "status">
): Promise<string> {
  const now = Date.now();
  const safeData = sanitizeListingData(data as Record<string, unknown>);
  const docRef = await addDoc(collection(db, "listings"), {
    ...safeData,
    createdAt: serverTimestamp(),
    sortKey: now,
    isArchived: false,
    status: "active",
  });
  return docRef.id;
}

export async function updateListing(
  id: string,
  userId: string,
  data: Partial<Omit<Listing, "id" | "createdAt" | "userId" | "userEmail" | "userName">>
): Promise<void> {
  const shouldDecrement =
    data.status === "sold" || data.isArchived === true;

  const safeUpdates = sanitizeListingData(data as Record<string, unknown>);
  await Promise.race([
    updateDoc(doc(db, "listings", id), safeUpdates),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("timeout:update-listing")), 6_000)
    ),
  ]);

  if (shouldDecrement && userId) {
    updateDoc(doc(db, "users", userId), {
      activeListingCount: increment(-1),
    }).catch(() => {});
  }
}

export const BUMP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function bumpListing(
  id: string
): Promise<{ success: boolean; nextBumpAt: number }> {
  const now = Date.now();
  const snap = await getDoc(doc(db, "listings", id));
  if (snap.exists()) {
    const lastBumpedAt: number = snap.data()?.lastBumpedAt ?? 0;
    if (now - lastBumpedAt < BUMP_COOLDOWN_MS) {
      return { success: false, nextBumpAt: lastBumpedAt + BUMP_COOLDOWN_MS };
    }
  }
  await Promise.race([
    updateDoc(doc(db, "listings", id), {
      lastBumpedAt: now,
      sortKey: now,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout:bump-listing")), 6_000)
    ),
  ]);
  return { success: true, nextBumpAt: now + BUMP_COOLDOWN_MS };
}

export async function markAsSold(id: string): Promise<void> {
  // Firestore atomic increment() counters (totalListings, totalInquiries, viewCount)
  // are never reset — this is intentional; they serve as monotonically increasing metrics.
  await Promise.race([
    updateDoc(doc(db, "listings", id), { status: "sold" }),
    new Promise<void>((resolve) => setTimeout(resolve, 6_000)),
  ]);
}

export async function writeRentalTcAuditLog(
  userId: string,
  userEmail: string,
  listingId: string,
  listingTitle: string
): Promise<void> {
  await addDoc(collection(db, "rentalAuditLogs"), {
    userId,
    userEmail,
    listingId,
    listingTitle,
    tcVersion: "rental-tc-v1",
    acceptedAt: Date.now(),
    userAgent: navigator.userAgent,
  });
}

export async function getListingsPage(
  type: ListingType,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ listings: Listing[]; cursor: QueryDocumentSnapshot | null; hasMore: boolean }> {
  const cacheKey = getCacheKey(type, cursor?.id ?? null);
  const cached = readCache<{ listings: Listing[]; cursor: QueryDocumentSnapshot | null; hasMore: boolean }>(cacheKey);
  if (cached) return cached;
  try {
    const constraints = [
      where("type", "==", type),
      where("isArchived", "==", false),
      where("status", "==", "active"),
      orderBy("sortKey", "desc"),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(PAGE_SIZE + 1),
    ];
    const snap = await getDocs(query(collection(db, "listings"), ...constraints));
    const hasMore = snap.docs.length > PAGE_SIZE;
    const pageDocs = snap.docs.slice(0, PAGE_SIZE);
    const listings = pageDocs.map(mapDoc);
    const nextCursor = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
    const result = { listings, cursor: nextCursor, hasMore };
    writeCache(cacheKey, result);
    return result;
  } catch (err: any) {
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      console.warn("[listings] Composite index not ready — using client-side fallback");
      const fallbackSnap = await getDocs(
        query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(PAGE_SIZE * 4))
      );
      const allDocs = fallbackSnap.docs.map(mapDoc);
      const filtered = allDocs.filter(
        (l) => l.type === type && l.isArchived === false && l.status === "active"
      );
      const page = filtered.slice(0, PAGE_SIZE);
      return { listings: page, cursor: null, hasMore: filtered.length > PAGE_SIZE };
    }
    throw err;
  }
}

export async function getListings(type: ListingType): Promise<Listing[]> {
  try {
    const q = query(
      collection(db, "listings"),
      where("type", "==", type),
      where("isArchived", "==", false),
      where("status", "==", "active"),
      orderBy("createdAt", "desc"),
      limit(40)
    );
    const snap = await getDocs(q);
    return snap.docs.map(mapDoc);
  } catch (err: any) {
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      console.warn("[listings] Composite index not ready — using client-side fallback for search");
      const snap = await getDocs(
        query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(160))
      );
      const docs = snap.docs.map(mapDoc);
      return docs.filter(
        (l) => l.type === type && l.isArchived === false && l.status === "active"
      );
    }
    throw err;
  }
}

export async function getListing(id: string): Promise<Listing | null> {
  const snap = await getDoc(doc(db, "listings", id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { id: snap.id, ...data, createdAt: toMillis(data.createdAt) } as Listing;
}

export async function getUserListings(userId: string): Promise<Listing[]> {
  try {
    const q = query(
      collection(db, "listings"),
      where("userId", "==", userId),
      where("isArchived", "==", false),
      orderBy("createdAt", "desc"),
      limit(40)
    );
    const snap = await getDocs(q);
    return snap.docs.map(mapDoc);
  } catch (err: any) {
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      const q2 = query(collection(db, "listings"), where("userId", "==", userId), limit(40));
      const snap = await getDocs(q2);
      const docs = snap.docs.map(mapDoc);
      return docs
        .filter((l) => l.isArchived === false)
        .sort((a, b) => b.createdAt - a.createdAt);
    }
    throw err;
  }
}

export async function deleteListing(listing: Listing): Promise<void> {
  if (listing.photos.length > 0) {
    await Promise.allSettled(
      listing.photos.map((url) => {
        const path = storagePathFromUrl(url);
        if (!path) return Promise.resolve();
        return deleteObject(ref(storage, path)).catch((err) => {
          if (err?.code !== "storage/object-not-found") throw err;
        });
      })
    );
  }

  await Promise.race([
    deleteDoc(doc(db, "listings", listing.id)),
    new Promise<void>((resolve) => setTimeout(resolve, 6_000)),
  ]);

  if (listing.userId && listing.status !== "sold" && !listing.isArchived) {
    updateDoc(doc(db, "users", listing.userId), {
      activeListingCount: increment(-1),
    }).catch(() => {});
  }
}

export async function getListingsByUser(uid: string): Promise<Listing[]> {
  try {
    const q = query(
      collection(db, "listings"),
      where("userId", "==", uid),
      where("isArchived", "==", false),
      where("status", "==", "active"),
      orderBy("sortKey", "desc"),
      limit(30)
    );
    const snap = await getDocs(q);
    return snap.docs.map(mapDoc);
  } catch (err: any) {
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      console.warn("[listings] getListingsByUser — index not ready, using client-side fallback");
      const q2 = query(collection(db, "listings"), where("userId", "==", uid), limit(60));
      const snap = await getDocs(q2);
      return snap.docs
        .map(mapDoc)
        .filter((l) => l.isArchived === false && l.status === "active")
        .sort((a, b) => (b.sortKey ?? b.createdAt) - (a.sortKey ?? a.createdAt))
        .slice(0, 30);
    }
    throw err;
  }
}

export async function searchListings(
  type: ListingType,
  keyword: string,
  minPrice?: number,
  maxPrice?: number,
  condition?: string
): Promise<Listing[]> {
  const all = await getListings(type);
  return all.filter((l) => {
    const kw = keyword.toLowerCase();
    const matchKeyword =
      !kw ||
      l.title.toLowerCase().includes(kw) ||
      l.description.toLowerCase().includes(kw) ||
      l.category.toLowerCase().includes(kw);
    const matchMin = minPrice == null || (l.price ?? 0) >= minPrice;
    const matchMax = maxPrice == null || (l.price ?? 0) <= maxPrice;
    const matchCond = !condition || condition === "all" || l.condition === condition;
    return matchKeyword && matchMin && matchMax && matchCond;
  });
}

export async function getSimilarListings(
  type: ListingType,
  category: string,
  excludeId: string
): Promise<Listing[]> {
  try {
    const q = query(
      collection(db, "listings"),
      where("type", "==", type),
      where("category", "==", category),
      where("isArchived", "==", false),
      where("status", "==", "active"),
      orderBy("sortKey", "desc"),
      limit(7)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(mapDoc)
      .filter((l) => l.id !== excludeId)
      .slice(0, 6);
  } catch (err: any) {
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      const fallback = await getDocs(
        query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(80))
      );
      return fallback.docs
        .map(mapDoc)
        .filter(
          (l) =>
            l.id !== excludeId &&
            l.type === type &&
            l.category === category &&
            l.isArchived === false &&
            l.status === "active"
        )
        .slice(0, 6);
    }
    return [];
  }
}
