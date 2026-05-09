import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import { Listing, SavedListing } from "./types";

export async function saveListing(uid: string, listing: Listing): Promise<void> {
  await setDoc(doc(db, "users", uid, "savedListings", listing.id), {
    listingId: listing.id,
    savedAt: Date.now(),
    listingTitle: listing.title,
    listingPhoto: listing.photos[0] ?? "",
    listingPrice: listing.price ?? null,
    listingUserId: listing.userId,
  });
}

export async function unsaveListing(uid: string, listingId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "savedListings", listingId));
}

export async function getSavedListings(uid: string): Promise<SavedListing[]> {
  const snap = await getDocs(
    query(collection(db, "users", uid, "savedListings"), orderBy("savedAt", "desc"))
  );
  return snap.docs.map((d) => d.data() as SavedListing);
}

export async function isListingSaved(uid: string, listingId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "users", uid, "savedListings", listingId));
  return snap.exists();
}
