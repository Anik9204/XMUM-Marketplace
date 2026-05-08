import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "./firebase";
import { SponsoredAd } from "./types";

// In-memory throttle: tracks how many times each ad has been shown
// this hour so we never exceed ad.timesPerHour.
const adShowCount: Record<string, { count: number; hourSlot: number }> = {};

function currentHourSlot(): number {
  return Math.floor(Date.now() / (1000 * 60 * 60));
}

function isAdThrottled(ad: SponsoredAd): boolean {
  const slot = currentHourSlot();
  const entry = adShowCount[ad.id];
  if (!entry || entry.hourSlot !== slot) return false;
  return entry.count >= (ad.timesPerHour ?? 3);
}

export function recordAdImpression(adId: string): void {
  const slot = currentHourSlot();
  const entry = adShowCount[adId];
  if (!entry || entry.hourSlot !== slot) {
    adShowCount[adId] = { count: 1, hourSlot: slot };
  } else {
    entry.count += 1;
  }
}

function isWithinActiveHours(ad: SponsoredAd): boolean {
  const durationHours = ad.durationHours ?? 24;
  if (durationHours >= 24) return true;
  // Active during the first N hours of each day (midnight-based, local time)
  const nowHour = new Date().getHours();
  return nowHour < durationHours;
}

export async function getActiveAds(count = 2): Promise<SponsoredAd[]> {
  try {
    const now = Date.now();
    const q = query(
      collection(db, "ads"),
      where("isActive", "==", true),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as SponsoredAd))
      .filter((ad) =>
        ad.endsAt > now &&
        ad.startsAt <= now &&
        !isAdThrottled(ad) &&
        isWithinActiveHours(ad)
      )
      .slice(0, count);
  } catch {
    return [];
  }
}
