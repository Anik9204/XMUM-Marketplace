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

// Convert a Firestore Timestamp (or plain number) to milliseconds.
// serverTimestamp() returns a Timestamp object on read; Date.now() returns a number.
// This normalises both so the UI always gets a plain number.
function toMillis(val: unknown): number {
  if (typeof val === "number") return val;
  if (val && typeof (val as any).toMillis === "function") return (val as any).toMillis();
  return Date.now();
}

function mapDoc(d: QueryDocumentSnapshot): Listing {
  const data = d.data();
  return { id: d.id, ...data, createdAt: toMillis(data.createdAt) } as Listing;
}

export async function uploadPhoto(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const storageRef = ref(storage, `listings/${userId}/${Date.now()}.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function createListing(
  data: Omit<Listing, "id" | "createdAt" | "isArchived" | "status">
): Promise<string> {
  const docRef = await addDoc(collection(db, "listings"), {
    ...data,
    createdAt: serverTimestamp(),
    isArchived: false,
    status: "active",
  });
  return docRef.id;
}

export async function markAsSold(id: string): Promise<void> {
  await Promise.race([
    updateDoc(doc(db, "listings", id), { status: "sold" }),
    new Promise<void>((resolve) => setTimeout(resolve, 6_000)),
  ]);
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
      orderBy("createdAt", "desc"),
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
      // True index-free fallback: single-field orderBy only — no composite index needed.
      // Fetches a larger batch and filters client-side so the feed works while the
      // composite index is being built in Firebase Console.
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
      // True index-free fallback: single-field orderBy, filter client-side
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

// Owners see ALL their listings including sold (no status filter)
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
        where("isArchived", "==", false),
        limit(40)
      );
      const snap = await getDocs(q2);
      const docs = snap.docs.map(mapDoc);
      return docs.sort((a, b) => b.createdAt - a.createdAt);
    }
    throw err;
  }
}

export async function deleteListing(listing: Listing): Promise<void> {
  if (listing.photos.length > 0) {
    await Promise.allSettled(
      listing.photos.map((url) =>
        deleteObject(ref(storage, url)).catch((err) => {
          if (err?.code !== "storage/object-not-found") throw err;
        })
      )
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
