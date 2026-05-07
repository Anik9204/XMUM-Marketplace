import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { AppNotification } from "./types";

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
