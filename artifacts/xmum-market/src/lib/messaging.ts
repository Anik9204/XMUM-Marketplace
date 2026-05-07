import {
  collection, doc, getDoc, setDoc, addDoc, getDocs,
  query, orderBy, limit, onSnapshot, updateDoc,
  serverTimestamp, where, Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Conversation {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPhoto: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: number;
  unreadCount: Record<string, number>;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
}

function toMillis(val: unknown): number {
  if (typeof val === "number") return val;
  if (val && typeof (val as any).toMillis === "function") return (val as any).toMillis();
  return Date.now();
}

export function getConversationId(uid1: string, uid2: string, listingId: string): string {
  return [uid1, uid2, listingId].sort().join("_");
}

export async function getOrCreateConversation(
  myUid: string,
  otherUid: string,
  listing: { id: string; title: string; photos: string[] }
): Promise<string> {
  const convId = getConversationId(myUid, otherUid, listing.id);
  const convRef = doc(db, "conversations", convId);

  // The Firestore read rule checks resource.data.participants, but resource is
  // null when the document doesn't exist yet — causing a permission-denied on
  // the read even for legitimate users. We catch that and treat it as
  // "not exists", then fall through to create the document.
  let exists = false;
  try {
    const snap = await getDoc(convRef);
    exists = snap.exists();
  } catch {
    exists = false;
  }

  if (!exists) {
    await setDoc(convRef, {
      listingId: listing.id,
      listingTitle: listing.title,
      listingPhoto: listing.photos[0] ?? "",
      participants: [myUid, otherUid],
      lastMessage: "",
      lastMessageAt: Date.now(),
      unreadCount: { [myUid]: 0, [otherUid]: 0 },
    });
  }
  return convId;
}

export async function sendMessage(
  convId: string,
  senderId: string,
  text: string,
  otherUid: string
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const convRef = doc(db, "conversations", convId);
  await addDoc(collection(db, "conversations", convId, "messages"), {
    senderId,
    text: trimmed,
    createdAt: serverTimestamp(),
  });

  const convSnap = await getDoc(convRef);
  await updateDoc(convRef, {
    lastMessage: trimmed.slice(0, 80),
    lastMessageAt: Date.now(),
    [`unreadCount.${otherUid}`]: (convSnap.data()?.unreadCount?.[otherUid] ?? 0) + 1,
  });
}

export function subscribeToMessages(
  convId: string,
  callback: (messages: Message[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("createdAt", "asc"),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    const msgs: Message[] = snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, createdAt: toMillis(data.createdAt) } as Message;
    });
    callback(msgs);
  });
}

export async function getUserConversations(uid: string): Promise<Conversation[]> {
  try {
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", uid),
      orderBy("lastMessageAt", "desc"),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, lastMessageAt: toMillis(data.lastMessageAt) } as Conversation;
    });
  } catch {
    return [];
  }
}

export async function markConversationRead(convId: string, uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, "conversations", convId), {
      [`unreadCount.${uid}`]: 0,
    });
  } catch {
    // Silent
  }
}
