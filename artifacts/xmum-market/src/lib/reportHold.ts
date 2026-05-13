import {
  collection, query, where, getDocs, updateDoc, doc, limit,
} from "firebase/firestore";
import { db } from "./firebase";

export async function listingHasActiveReport(listingId: string): Promise<boolean> {
  const q = query(
    collection(db, "reports"),
    where("listingId", "==", listingId),
    where("status", "in", ["pending", "reviewed"]),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function shopListingHasActiveReport(listingId: string): Promise<boolean> {
  const q = query(
    collection(db, "reports"),
    where("listingId", "==", listingId),
    where("status", "in", ["pending", "reviewed"]),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function userHasHeldListings(userId: string): Promise<boolean> {
  const q = query(
    collection(db, "listings"),
    where("userId", "==", userId),
    where("isReportHeld", "==", true),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function applyReportHold(listingId: string): Promise<void> {
  await updateDoc(doc(db, "listings", listingId), {
    isReportHeld: true,
    reportHeldAt: Date.now(),
    isArchived: true,
  });
}

export async function applyShopListingReportHold(listingId: string): Promise<void> {
  await updateDoc(doc(db, "shopListings", listingId), {
    isReportHeld: true,
    reportHeldAt: Date.now(),
    isActive: false,
  });
}

export async function liftReportHold(listingId: string): Promise<void> {
  await updateDoc(doc(db, "listings", listingId), {
    isReportHeld: false,
    reportHeldAt: null,
    isArchived: false,
  });
}

export async function liftShopListingReportHold(listingId: string): Promise<void> {
  await updateDoc(doc(db, "shopListings", listingId), {
    isReportHeld: false,
    reportHeldAt: null,
    isActive: true,
  });
}
