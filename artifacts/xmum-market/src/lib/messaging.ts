import {
  collection, doc, getDoc, setDoc, addDoc, getDocs, increment,
  query, orderBy, limit, onSnapshot, updateDoc, arrayUnion,
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
  typing?: Record<string, boolean>;
  clearedAt?: Record<string, number>;
  shopName?: string;
  shopOwnerUid?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
  seenBy?: string[];
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
  listing: { id: string; title: string; photos: string[] },
  shopContext?: { shopName: string; shopOwnerUid: string }
): Promise<string> {
  const convId = getConversationId(myUid, otherUid, listing.id);
  const convRef = doc(db, "conversations", convId);

  let exists = false;
  try {
    const snap = await getDoc(convRef);
    exists = snap.exists();
    if (exists && shopContext && !snap.data()?.shopName) {
      await updateDoc(convRef, {
        shopName: shopContext.shopName,
        shopOwnerUid: shopContext.shopOwnerUid,
      }).catch(() => {});
    }
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
      typing: {},
      ...(shopContext ? { shopName: shopContext.shopName, shopOwnerUid: shopContext.shopOwnerUid } : {}),
    });
  }
  return convId;
}

export async function sendMessage(
  convId: string,
  senderId: string,
  senderName: string,
  text: string,
  otherUid: string,
  listingTitle: string = ""
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const convRef = doc(db, "conversations", convId);
  await addDoc(collection(db, "conversations", convId, "messages"), {
    senderId,
    text: trimmed,
    createdAt: serverTimestamp(),
    seenBy: [],
  });

  await updateDoc(convRef, {
    lastMessage: trimmed.slice(0, 80),
    lastMessageAt: Date.now(),
    [`unreadCount.${otherUid}`]: increment(1),
  });

  try {
    await sendNewMessageNotification(
      otherUid,
      senderName,
      listingTitle
    );
  } catch {}
}

export function subscribeToMessages(
  convId: string,
  callback: (messages: Message[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("createdAt", "asc"),
    limit(150)
  );
  return onSnapshot(q, (snap) => {
    const msgs: Message[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: toMillis(data.createdAt),
        seenBy: data.seenBy ?? [],
      } as Message;
    });
    callback(msgs);
  });
}

// ── Real-time conversation list ────────────────────────────────────────────────
export function subscribeToConversations(
  uid: string,
  callback: (convs: Conversation[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", uid),
    limit(50)
  );
  return onSnapshot(
    q,
    (snap) => {
      const convs = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            lastMessageAt: toMillis(data.lastMessageAt),
          } as Conversation;
        })
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      callback(convs);
    },
    () => callback([])
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────────
export async function setTypingStatus(
  convId: string,
  uid: string,
  isTyping: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, "conversations", convId), {
      [`typing.${uid}`]: isTyping,
    });
  } catch {
    // silent — typing indicator is best-effort
  }
}

export function subscribeToTyping(
  convId: string,
  _uid: string,
  otherUid: string,
  callback: (isTyping: boolean) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "conversations", convId),
    (snap) => {
      if (!snap.exists()) { callback(false); return; }
      const typing = snap.data()?.typing ?? {};
      callback(typing[otherUid] === true);
    },
    () => callback(false)
  );
}

// ── Legacy one-time fetch (kept for compatibility) ─────────────────────────────
export async function getUserConversations(uid: string): Promise<Conversation[]> {
  try {
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", uid),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return { id: d.id, ...data, lastMessageAt: toMillis(data.lastMessageAt) } as Conversation;
      })
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  } catch (err) {
    console.error("[messaging] getUserConversations failed:", err);
    return [];
  }
}

export async function clearConversation(convId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, "conversations", convId), {
    [`clearedAt.${uid}`]: Date.now(),
  });
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

export async function markMessagesAsSeen(
  convId: string,
  uid: string,
  messageIds: string[]
): Promise<void> {
  if (messageIds.length === 0) return;
  await Promise.allSettled(
    messageIds.map((msgId) =>
      updateDoc(doc(db, "conversations", convId, "messages", msgId), {
        seenBy: arrayUnion(uid),
      })
    )
  );
}

export async function sendNewMessageNotification(
  recipientUid: string,
  senderName: string,
  listingTitle: string
): Promise<void> {
  try {
    const { addNotification } = await import("./notifications");
    await addNotification(recipientUid, {
      type: "new_message",
      title: `New message from ${senderName}`,
      body: `Re: ${listingTitle}`,
    });
  } catch {}
}

export async function getOlderMessages(
  convId: string,
  oldestMessageId: string,
  oldestCreatedAt: number
): Promise<Message[]> {
  const q = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("createdAt", "asc"),
    where("createdAt", "<", oldestCreatedAt),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: typeof data.createdAt === "number"
        ? data.createdAt
        : data.createdAt?.toMillis?.() ?? Date.now(),
      seenBy: data.seenBy ?? [],
    } as Message;
  });
}

// Real-time listener — sums unreadCount[uid] across all the user's conversations.
export function subscribeToUnreadCount(
  uid: string,
  callback: (totalUnread: number) => void
): Unsubscribe {
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", uid),
    limit(50)
  );
  return onSnapshot(
    q,
    (snap) => {
      const total = snap.docs.reduce((sum, d) => {
        const count = d.data()?.unreadCount?.[uid] ?? 0;
        return sum + (typeof count === "number" ? count : 0);
      }, 0);
      callback(total);
    },
    () => callback(0)
  );
}
