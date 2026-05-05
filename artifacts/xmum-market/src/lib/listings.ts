import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "./firebase";
import { Listing, ListingType } from "./types";

export async function uploadPhoto(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const storageRef = ref(storage, `listings/${userId}/${Date.now()}.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function createListing(
  data: Omit<Listing, "id" | "createdAt" | "isArchived">
): Promise<string> {
  const docRef = await addDoc(collection(db, "listings"), {
    ...data,
    createdAt: Date.now(),
    isArchived: false,
  });
  return docRef.id;
}

export async function getListings(type: ListingType): Promise<Listing[]> {
  try {
    const q = query(
      collection(db, "listings"),
      where("type", "==", type),
      where("isArchived", "==", false),
      orderBy("createdAt", "desc"),
      limit(40)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Listing));
  } catch (err: any) {
    // If index not yet built, fall back to unordered query
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      const q2 = query(
        collection(db, "listings"),
        where("type", "==", type),
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

export async function getListing(id: string): Promise<Listing | null> {
  const snap = await getDoc(doc(db, "listings", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Listing;
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
  // Step 1: delete all photos in parallel — each one resolves immediately on
  // success or "object-not-found"; any other Storage error is re-thrown.
  if (listing.photos.length > 0) {
    await Promise.all(
      listing.photos.map((url) =>
        deleteObject(ref(storage, url)).catch((err) => {
          if (err?.code !== "storage/object-not-found") throw err;
        })
      )
    );
  }

  // Step 2: delete the Firestore document. With offline persistence the SDK
  // writes to the local cache first and resolves immediately; on a slow or
  // cold connection it can hang waiting for server ACK. We race against a
  // 6-second resolve so the UI always unblocks — the SDK will continue
  // syncing the delete to the server in the background.
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
