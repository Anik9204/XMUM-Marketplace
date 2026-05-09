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
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "./firebase";
import { Listing, ListingType } from "./types";

const PAGE_SIZE = 12;

export const LISTING_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const LISTING_REMINDER_MS = 23 * 24 * 60 * 60 * 1000; // 23 days (7-day warning)

// Convert a Firestore Timestamp (or plain number) to milliseconds.
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

// Extract the Firebase Storage path from a full https:// download URL.
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

// ── MIGRATION NOTE ────────────────────────────────────────────────────────────
// Existing listing documents do NOT have a sortKey field.
// Before deploying to production, run a one-time migration script that sets
// sortKey = createdAt for all existing documents, or the new sortKey-based
// index/query will return inconsistent results.
// New listings created after this deployment will have sortKey set automatically.
// ──────────────────────────────────────────────────────────────────────────────
export async function createListing(
  data: Omit<Listing, "id" | "createdAt" | "isArchived" | "status">
): Promise<string> {
  const now = Date.now();
  const docRef = await addDoc(collection(db, "listings"), {
    ...data,
    createdAt: serverTimestamp(),
    sortKey: now,
    isArchived: false,
    status: "active",
  });
  return docRef.id;
}

export async function updateListing(
  id: string,
  data: Partial<Omit<Listing, "id" | "createdAt" | "userId" | "userEmail" | "userName">>
): Promise<void> {
  await Promise.race([
    updateDoc(doc(db, "listings", id), data),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("timeout:update-listing")), 6_000)
    ),
  ]);
}

export async function bumpListing(id: string): Promise<void> {
  const now = Date.now();
  await Promise.race([
    updateDoc(doc(db, "listings", id), {
      lastBumpedAt: now,
      sortKey: now,
    }),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("timeout:bump-listing")), 6_000)
    ),
  ]);
}

// Race against 6s timeout as a safety net in case of slow server response
// in Replit's proxy environment.
export async function markAsSold(id: string): Promise<void> {
  await Promise.race([
    updateDoc(doc(db, "listings", id), { status: "sold" }),
    new Promise<void>((resolve) => setTimeout(resolve, 6_000)),
  ]);
}

// ── Rental T&C Audit Log ───────────────────────────────────────────────────────
// This write is append-only — Firestore rules deny update/delete for non-admins.
// The record persists even if the listing or user account is later deleted.
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

// ── Paginated feed for home page ───────────────────────────────────────────────
export async function getListingsPage(
  type: ListingType,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ listings: Listing[]; cursor: QueryDocumentSnapshot | null; hasMore: boolean }> {
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
    return { listings, cursor: nextCursor, hasMore };
  } catch (err: any) {
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      console.warn("[listings] Composite index not ready — using client-side fallback");
      const fallbackSnap = await getDocs(
        query(
          collection(db, "listings"),
          orderBy("createdAt", "desc"),
          limit(PAGE_SIZE * 4)
        )
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

// ── Full list for search (used by searchListings) ──────────────────────────────
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
        query(
          collection(db, "listings"),
          orderBy("createdAt", "desc"),
          limit(160)
        )
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

// Owners see ALL their listings including sold (no status filter).
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
      const q2 = query(
        collection(db, "listings"),
        where("userId", "==", userId),
        limit(40)
      );
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
