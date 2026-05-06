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
    createdAt: Date.now(),
    isArchived: false,
    status: "available",
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
      where("status", "==", "available"),
      orderBy("createdAt", "desc"),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(PAGE_SIZE + 1),
    ];
    const snap = await getDocs(query(collection(db, "listings"), ...constraints));
    const hasMore = snap.docs.length > PAGE_SIZE;
    const pageDocs = snap.docs.slice(0, PAGE_SIZE);
    const listings = pageDocs.map((d) => ({ id: d.id, ...d.data() } as Listing));
    const nextCursor = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
    return { listings, cursor: nextCursor, hasMore };
  } catch (err: any) {
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      // Fallback: existing type+isArchived+createdAt index, client-side status filter
      const fallback = [
        where("type", "==", type),
        where("isArchived", "==", false),
        orderBy("createdAt", "desc"),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(PAGE_SIZE + 1),
      ];
      const snap = await getDocs(query(collection(db, "listings"), ...fallback));
      const hasMore = snap.docs.length > PAGE_SIZE;
      const pageDocs = snap.docs.slice(0, PAGE_SIZE);
      const listings = pageDocs
        .map((d) => ({ id: d.id, ...d.data() } as Listing))
        .filter((l) => l.status !== "sold");
      const nextCursor = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
      return { listings, cursor: nextCursor, hasMore };
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
      where("status", "==", "available"),
      orderBy("createdAt", "desc"),
      limit(40)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Listing));
  } catch (err: any) {
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      const q2 = query(
        collection(db, "listings"),
        where("type", "==", type),
        where("isArchived", "==", false),
        limit(40)
      );
      const snap = await getDocs(q2);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Listing));
      return docs
        .filter((l) => l.status !== "sold")
        .sort((a, b) => b.createdAt - a.createdAt);
    }
    throw err;
  }
}

export async function getListing(id: string): Promise<Listing | null> {
  const snap = await getDoc(doc(db, "listings", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Listing;
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
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Listing));
  } catch (err: any) {
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      const q2 = query(
        collection(db, "listings"),
        where("userId", "==", userId),
        where("isArchived", "==", false),
        limit(40)
      );
      const snap = await getDocs(q2);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Listing));
      return docs.sort((a, b) => b.createdAt - a.createdAt);
    }
    throw err;
  }
}

export async function deleteListing(listing: Listing): Promise<void> {
  if (listing.photos.length > 0) {
    await Promise.all(
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
