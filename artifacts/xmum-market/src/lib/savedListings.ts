import {
  doc,
  getDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "./firebase";
import { Listing, SavedListing } from "./types";

async function getUserSavedIds(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  const data = snap.data();
  return Array.isArray(data?.savedListingIds) ? (data.savedListingIds as string[]) : [];
}

export async function saveListing(uid: string, listing: Listing): Promise<void> {
  await setDoc(
    doc(db, "users", uid),
    { savedListingIds: arrayUnion(listing.id) },
    { merge: true }
  );
}

export async function unsaveListing(uid: string, listingId: string): Promise<void> {
  await setDoc(
    doc(db, "users", uid),
    { savedListingIds: arrayRemove(listingId) },
    { merge: true }
  );
}

// NOTE: Returns placeholder metadata (savedAt: 0, listingTitle: "", etc.) —
// only the listingId is populated. The caller must enrich each entry by calling
// getListing(id) before displaying data to the user. The Profile page's Saved
// tab handles this enrichment via individual getListing() calls per saved ID.
export async function getSavedListings(uid: string): Promise<SavedListing[]> {
  const ids = await getUserSavedIds(uid);
  return ids.map((id) => ({
    listingId: id,
    savedAt: 0,
    listingTitle: "",
    listingPhoto: "",
    listingUserId: "",
  }));
}

export async function isListingSaved(uid: string, listingId: string): Promise<boolean> {
  const ids = await getUserSavedIds(uid);
  return ids.includes(listingId);
}
