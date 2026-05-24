import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AiFlagContext =
  | "listing"
  | "shop-listing"
  | "shop-profile"
  | "inquiry"
  | "review";

export interface AiFlagData {
  context: AiFlagContext;
  reason: string;
  content: string;
  listingId?: string;
  listingTitle?: string;
  shopId?: string;
  shopName?: string;
  shopSlug?: string;
  userId: string;
  userEmail: string;
  createdAt: number;
  status: "pending";
}

export async function writeAiFlag(data: AiFlagData): Promise<void> {
  try {
    await addDoc(collection(db, "aiFlags"), data);
  } catch {
    // Non-critical — silently ignore
  }
}
