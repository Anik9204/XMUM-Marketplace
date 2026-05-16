import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getConfig() {
  try {
    const snap = await db.collection("appConfig").doc("subscriptions").get();
    if (snap.exists) {
      const d = snap.data()!;
      return {
        launchDate:       d.launchDate       ?? 0,
        trialDays:        d.trialDays        ?? 60,
        subscriptionDays: d.subscriptionDays ?? 30,
        graceDays:        d.graceDays        ?? 30,
      };
    }
  } catch {}
  return { launchDate: 0, trialDays: 60, subscriptionDays: 30, graceDays: 30 };
}

async function sendNotification(
  uid: string,
  data: { type: string; title: string; body: string; shopId: string }
) {
  try {
    await db.collection("users").doc(uid).collection("notifications").add({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
    });
  } catch (err) {
    console.warn("[sendNotification] failed:", err);
  }
}

// ── Scheduled function — runs daily at 08:00 Malaysia time (UTC+8 = 00:00 UTC) ──

export const shopSubscriptionDailyCheck = functions
  .region("asia-southeast1")  // Singapore — closest to Malaysia
  .pubsub.schedule("0 0 * * *")  // 00:00 UTC = 08:00 MYT
  .timeZone("Asia/Kuala_Lumpur")
  .onRun(async () => {
    const now = Date.now();
    const config = await getConfig();
    const SEVEN_DAYS_MS  = 7  * 24 * 60 * 60 * 1000;
    const GRACE_MS       = config.graceDays * 24 * 60 * 60 * 1000;

    // Fetch all approved, non-expired shops
    const shopsSnap = await db
      .collection("shops")
      .where("approvalStatus", "==", "approved")
      .get();

    const batch = db.batch();
    const notificationJobs: Promise<void>[] = [];

    for (const shopDoc of shopsSnap.docs) {
      const shop = shopDoc.data();
      const shopId      = shopDoc.id;
      const ownerId     = shop.ownerId     ?? shop.ownerUid ?? "";
      const shopName    = shop.name        ?? shop.shopName ?? "";
      const expiresAt   = shop.subscriptionExpiresAt ?? 0;
      const status      = shop.subscriptionStatus ?? "active";
      const reminderSentAt = shop.reminderSentAt ?? 0;

      if (!expiresAt || !ownerId) continue;

      const msUntilExpiry = expiresAt - now;
      const graceEnd = expiresAt + GRACE_MS;

      // ── Case 1: Active/trial shop expiring within 7 days — send reminder ──
      if (
        (status === "active" || status === "trial") &&
        msUntilExpiry > 0 &&
        msUntilExpiry <= SEVEN_DAYS_MS &&
        now - reminderSentAt > SEVEN_DAYS_MS  // don't double-send within 7 days
      ) {
        const daysLeft = Math.max(1, Math.ceil(msUntilExpiry / (24 * 60 * 60 * 1000)));
        const expiryDateStr = new Date(expiresAt).toLocaleDateString("en-MY", {
          day: "numeric", month: "long", year: "numeric",
        });

        // Notify shop owner
        notificationJobs.push(sendNotification(ownerId, {
          type:   "shop_subscription_expiring",
          title:  `⚠️ Shop subscription expiring in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
          body:   `Your shop "${shopName}" subscription expires on ${expiryDateStr}. Contact an admin to renew and keep your shop active.`,
          shopId,
        }));

        // Mark reminder sent
        batch.update(shopDoc.ref, { reminderSentAt: now });

        // Also write an admin notification to a shared "adminNotifications" collection
        // so admins can see it on their next login
        notificationJobs.push((async () => {
          try {
            await db.collection("adminNotifications").add({
              type:      "shop_expiring_soon",
              title:     `Shop expiring soon: "${shopName}"`,
              body:      `Shop "${shopName}" (owner: ${shop.ownerEmail ?? ""}) expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} on ${expiryDateStr}.`,
              shopId,
              shopName,
              ownerEmail: shop.ownerEmail ?? "",
              expiresAt,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              read: false,
            });
          } catch {}
        })());
      }

      // ── Case 2: Subscription just expired — move to grace ──
      if ((status === "active" || status === "trial") && msUntilExpiry <= 0) {
        batch.update(shopDoc.ref, {
          isActive:           false,
          subscriptionStatus: "grace",
        });

        notificationJobs.push(sendNotification(ownerId, {
          type:   "shop_subscription_expired",
          title:  "⚠️ Shop subscription has expired",
          body:   `Your shop "${shopName}" subscription has expired and is now hidden from Campus Market. You have 30 days to contact an admin to renew.`,
          shopId,
        }));
      }

      // ── Case 3: Grace period expired — mark as permanently expired ──
      if (status === "grace" && now > graceEnd) {
        batch.update(shopDoc.ref, {
          isActive:           false,
          subscriptionStatus: "expired",
        });
      }
    }

    await batch.commit();
    await Promise.allSettled(notificationJobs);

    console.log(`[shopSubscriptionDailyCheck] processed ${shopsSnap.size} shops at ${new Date().toISOString()}`);
    return null;
  });
