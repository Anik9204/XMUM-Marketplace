import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  getDoc,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { AppNotification, Listing } from "./types";
import { getUserConversations } from "./messaging";

function toMillis(val: unknown): number {
  if (typeof val === "number") return val;
  if (val && typeof (val as any).toMillis === "function") return (val as any).toMillis();
  return Date.now();
}

export async function addNotification(
  uid: string,
  data: Omit<AppNotification, "id" | "createdAt" | "read">
): Promise<void> {
  try {
    await addDoc(collection(db, "users", uid, "notifications"), {
      ...data,
      createdAt: serverTimestamp(),
      read: false,
    });
  } catch {
    // Notifications are non-critical — silently fail
  }
}

export async function getNotifications(uid: string): Promise<AppNotification[]> {
  try {
    const q = query(
      collection(db, "users", uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, createdAt: toMillis(data.createdAt) } as AppNotification;
    });
  } catch {
    return [];
  }
}

export async function markNotificationsRead(uid: string, ids: string[]): Promise<void> {
  try {
    await Promise.allSettled(
      ids.map((id) => updateDoc(doc(db, "users", uid, "notifications", id), { read: true }))
    );
  } catch {
    // Silent
  }
}

export function subscribeToNotifications(
  uid: string,
  callback: (notifs: AppNotification[]) => void
): () => void {
  const q = query(
    collection(db, "users", uid, "notifications"),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  return onSnapshot(
    q,
    (snap) => {
      const notifs = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: toMillis(data.createdAt),
        } as AppNotification;
      });
      callback(notifs);
    },
    () => {} // silently ignore snapshot errors (offline, permissions)
  );
}

// ── Campus Market notification helpers ──────────────────────────────────────

export async function notifyShopInquiryReceived(
  shopOwnerId: string,
  shopName: string,
  buyerName: string,
  inquiryId: string,
  shopId: string,
): Promise<void> {
  await addNotification(shopOwnerId, {
    type: "shop_inquiry_received",
    title: "New inquiry received",
    body: `${buyerName} sent an inquiry to your shop "${shopName}".`,
    shopId,
    inquiryId,
  });
}

export async function notifyInquiryStatusChanged(
  buyerId: string,
  shopName: string,
  newStatus: string,
  inquiryId: string,
  shopId: string,
): Promise<void> {
  const statusLabel =
    newStatus === "confirmed" ? "confirmed" :
    newStatus === "completed" ? "completed" :
    newStatus === "cancelled" ? "cancelled" : newStatus;

  const type =
    newStatus === "confirmed" ? "shop_inquiry_confirmed" :
    newStatus === "completed" ? "shop_inquiry_completed" :
    "shop_inquiry_received" as AppNotification["type"];

  await addNotification(buyerId, {
    type,
    title: `Inquiry ${statusLabel}`,
    body: `Your inquiry to "${shopName}" has been ${statusLabel}.`,
    shopId,
    inquiryId,
  });
}

export async function notifyShopAdApproved(
  shopOwnerId: string,
  shopName: string,
  shopId: string,
): Promise<void> {
  await addNotification(shopOwnerId, {
    type: "shop_ad_approved",
    title: "Shop ad approved",
    body: `Your ad for "${shopName}" has been approved and will be displayed in Campus Market.`,
    shopId,
  });
}

export async function notifyShopAdRejected(
  shopOwnerId: string,
  shopName: string,
  adminNote: string,
  shopId: string,
): Promise<void> {
  await addNotification(shopOwnerId, {
    type: "shop_ad_rejected",
    title: "Shop ad rejected",
    body: adminNote
      ? `Your ad for "${shopName}" was rejected: ${adminNote}`
      : `Your ad for "${shopName}" was not approved. Please review and resubmit.`,
    shopId,
  });
}

const DIGEST_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function sendDailyDigestIfDue(uid: string, listings: Listing[]): Promise<void> {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const lastDigestSentAt: number = userSnap.data()?.lastDigestSentAt ?? 0;
    if (Date.now() - lastDigestSentAt < DIGEST_COOLDOWN_MS) return;

    const activeListings = listings.filter(l => l.status === "active" && !l.isArchived);
    const totalViews = activeListings.reduce((sum, l) => sum + (l.viewCount ?? 0), 0);

    const conversations = await getUserConversations(uid);
    const unreadMessages = conversations.reduce(
      (sum, c) => sum + (c.unreadCount?.[uid] ?? 0),
      0
    );

    const N = activeListings.length;
    const V = totalViews;
    const M = unreadMessages;

    await addNotification(uid, {
      type: "daily_digest",
      title: "Your daily marketplace summary",
      body: `Your ${N} listing${N === 1 ? "" : "s"} received ${V} view${V === 1 ? "" : "s"} in the last 24h. You have ${M} unread message${M === 1 ? "" : "s"}.`,
    });

    await updateDoc(userRef, { lastDigestSentAt: Date.now() });
  } catch {
    // Non-critical — silently ignore all errors
  }
}
