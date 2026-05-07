import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "./firebase";
import { SponsoredAd } from "./types";

export async function getActiveAds(count = 2): Promise<SponsoredAd[]> {
  try {
    const now = Date.now();
    const q = query(
      collection(db, "ads"),
      where("isActive", "==", true),
      where("endsAt", ">", now),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SponsoredAd));
  } catch {
    return [];
  }
}
