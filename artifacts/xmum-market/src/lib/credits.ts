import {
  collection, doc, addDoc, getDoc, getDocs,
  query, where, orderBy, runTransaction, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShopCreditLog } from "@/lib/types";

/**
 * Spend credits from a shop balance atomically via Firestore transaction.
 * Throws with a user-readable message if balance is insufficient.
 * Returns the new balance after deduction.
 */
export async function spendShopCredits(
  shopId: string,
  amount: number,
  reason: string
): Promise<number> {
  if (amount <= 0) throw new Error("Amount must be positive.");

  let balanceBefore = 0;
  let newBalance = 0;

  await runTransaction(db, async (tx) => {
    const shopRef = doc(db, "shops", shopId);
    const shopSnap = await tx.get(shopRef);
    if (!shopSnap.exists()) throw new Error("Shop not found.");
    balanceBefore = (shopSnap.data().creditBalance as number) ?? 0;
    if (balanceBefore < amount) {
      throw new Error(
        `Not enough credits. You have ${balanceBefore} credit${balanceBefore !== 1 ? "s" : ""}, but this costs ${amount}.`
      );
    }
    newBalance = balanceBefore - amount;
    tx.update(shopRef, { creditBalance: newBalance });
  });

  // Write audit log — best-effort, non-blocking
  const shopSnap = await getDoc(doc(db, "shops", shopId));
  addDoc(collection(db, "shopCreditLogs"), {
    shopId,
    shopName: shopSnap.data()?.name ?? "",
    adminEmail: "",
    amount: -amount,
    reason,
    balanceBefore,
    balanceAfter: newBalance,
    createdAt: Date.now(),
  } as Omit<ShopCreditLog, "id">).catch(() => {});

  return newBalance;
}

/**
 * Fetch credit log for a shop, newest first.
 * Falls back to unordered query if composite index is not yet built.
 */
export async function getShopCreditLogs(
  shopId: string,
  limitCount = 20
): Promise<ShopCreditLog[]> {
  try {
    const q = query(
      collection(db, "shopCreditLogs"),
      where("shopId", "==", shopId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopCreditLog));
  } catch {
    // Fallback: no orderBy, sort client-side
    const q2 = query(
      collection(db, "shopCreditLogs"),
      where("shopId", "==", shopId)
    );
    const snap2 = await getDocs(q2);
    return snap2.docs
      .map((d) => ({ id: d.id, ...d.data() } as ShopCreditLog))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limitCount);
  }
}
