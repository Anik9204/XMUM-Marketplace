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
        reminderDays:     d.reminderDays     ?? 7,
      };
    }
  } catch {}
  return { launchDate: 0, trialDays: 60, subscriptionDays: 30, graceDays: 30, reminderDays: 7 };
}

async function sendNotification(
  uid: string,
  data: {
    type:     string;
    title:    string;
    body:     string;
    shopId:   string;
    shopName: string;
  }
) {
  try {
    await db.collection("users").doc(uid).collection("notifications").add({
      title:     data.title,
      body:      data.body,
      type:      data.type,
      shopId:    data.shopId,
      shopName:  data.shopName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read:      false,
    });
  } catch (err) {
    console.warn(`[sendNotification] failed for uid=${uid}:`, err);
  }
}

async function getAdminUids(): Promise<string[]> {
  try {
    const snap = await db.collection("users").where("role", "==", "admin").get();
    return snap.docs.map((d) => d.id);
  } catch (err) {
    console.warn("[getAdminUids] failed:", err);
    return [];
  }
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-MY", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kuala_Lumpur",
  });
}

// ── Scheduled function — runs daily at 08:00 Malaysia time ───────────────────

export const dailySubscriptionCheck = functions
  .region("asia-southeast1")
  .pubsub.schedule("0 8 * * *")
  .timeZone("Asia/Kuala_Lumpur")
  .onRun(async () => {
    try {
      const now    = Date.now();
      const config = await getConfig();
      const GRACE_MS      = config.graceDays   * 24 * 60 * 60 * 1000;
      const REMINDER_MS   = config.reminderDays * 24 * 60 * 60 * 1000;

      const shopsSnap = await db
        .collection("shops")
        .where("approvalStatus", "==", "approved")
        .get();

      const adminUids = await getAdminUids();

      const batchWrites = db.batch();
      const notificationJobs: Promise<void>[] = [];

      let countExpired  = 0;
      let countGrace    = 0;
      let countReminder = 0;

      for (const shopDoc of shopsSnap.docs) {
        try {
          const shop       = shopDoc.data();
          const shopId     = shopDoc.id;
          const ownerId    = shop.ownerId    ?? shop.ownerUid  ?? "";
          const shopName   = shop.name       ?? shop.shopName  ?? "";
          const ownerEmail = shop.ownerEmail ?? "";
          const expiresAt  = shop.subscriptionExpiresAt ?? 0;
          const status     = shop.subscriptionStatus    ?? "active";
          const reminderSentAt = shop.reminderSentAt    ?? null;

          if (!expiresAt || !ownerId) continue;

          const msUntilExpiry  = expiresAt - now;
          const graceEnd       = expiresAt + GRACE_MS;
          const daysUntilExpiry = msUntilExpiry / (24 * 60 * 60 * 1000);
          const graceEndsMs    = graceEnd;
          const daysLeftInGrace = Math.max(0, Math.ceil((graceEndsMs - now) / (24 * 60 * 60 * 1000)));

          const isPastGrace = status === "grace" && now > graceEnd;
          const isInGrace   = (status === "active" || status === "trial") && msUntilExpiry <= 0
                            || (status === "grace");
          const needsReminder =
            (status === "active" || status === "trial") &&
            daysUntilExpiry > 0 &&
            daysUntilExpiry <= config.reminderDays &&
            !reminderSentAt;

          // STEP: isPastGrace — permanently expire
          if (isPastGrace) {
            batchWrites.update(shopDoc.ref, {
              subscriptionStatus: "expired",
              isActive:           false,
            });
            countExpired++;
            continue;
          }

          // STEP: Just expired, move to grace
          if (
            (status === "active" || status === "trial") &&
            msUntilExpiry <= 0
          ) {
            batchWrites.update(shopDoc.ref, {
              subscriptionStatus: "grace",
              isActive:           false,
            });
            countGrace++;

            const graceExpiryStr = fmtDate(graceEnd);

            // Notify shop owner
            notificationJobs.push(sendNotification(ownerId, {
              type:     "subscription_grace",
              title:    "⚠️ Your shop has been hidden",
              body:     `Your subscription for "${shopName}" has expired. Your shop is now hidden from the marketplace. You have ${daysLeftInGrace} day${daysLeftInGrace === 1 ? "" : "s"} remaining to contact the admin and renew your subscription before your data is removed.`,
              shopId,
              shopName,
            }));

            // Notify all admins
            for (const adminUid of adminUids) {
              notificationJobs.push(sendNotification(adminUid, {
                type:     "subscription_grace",
                title:    `🔔 Shop Subscription Expired: ${shopName}`,
                body:     `The shop "${shopName}" owned by ${ownerEmail} has expired and entered the grace period (until ${graceExpiryStr}). Please follow up with the owner for renewal.`,
                shopId,
                shopName,
              }));
            }
            continue;
          }

          // STEP: Already in grace — notify admins (only once, when status transitions)
          if (status === "grace" && !isPastGrace) {
            // Grace already notified when it transitioned above; nothing to do here
          }

          // STEP: Send renewal reminder
          if (needsReminder) {
            const daysLeft     = Math.max(1, Math.ceil(daysUntilExpiry));
            const expiryDateStr = fmtDate(expiresAt);

            batchWrites.update(shopDoc.ref, { reminderSentAt: now });
            countReminder++;

            // Notify shop owner
            notificationJobs.push(sendNotification(ownerId, {
              type:     "subscription_reminder",
              title:    `⏰ Your subscription expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
              body:     `Your shop "${shopName}" subscription will expire on ${expiryDateStr}. Please contact the admin to renew your subscription before your shop is hidden from the marketplace.`,
              shopId,
              shopName,
            }));

            // Notify all admins
            for (const adminUid of adminUids) {
              notificationJobs.push(sendNotification(adminUid, {
                type:     "subscription_reminder",
                title:    `🔔 Renewal Reminder: ${shopName}`,
                body:     `The shop "${shopName}" subscription expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} on ${expiryDateStr}. Owner: ${ownerEmail}. Please follow up.`,
                shopId,
                shopName,
              }));
            }
          }

        } catch (shopErr) {
          console.error(`[dailySubscriptionCheck] error processing shop ${shopDoc.id}:`, shopErr);
          // continue processing remaining shops
        }
      }

      await batchWrites.commit();
      await Promise.allSettled(notificationJobs);

      console.log(
        `[dailySubscriptionCheck] complete. ` +
        `Processed: ${shopsSnap.size} shops. ` +
        `Expired: ${countExpired}. ` +
        `In grace: ${countGrace}. ` +
        `Reminders sent: ${countReminder}.`
      );
    } catch (err) {
      console.error("[dailySubscriptionCheck] fatal error:", err);
    }

    return null;
  });

// ── Scheduled function — runs daily at 03:00 Malaysia time ───────────────────

export const dailySoldListingCleanup = functions
  .region("asia-southeast1")
  .pubsub.schedule("0 3 * * *")
  .timeZone("Asia/Kuala_Lumpur")
  .onRun(async () => {
    try {
      const now = Date.now();
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

      const soldSnap = await db
        .collection("listings")
        .where("status", "==", "sold")
        .get();

      let countStamped = 0;
      let countDeleted = 0;
      let countErrors  = 0;

      const jobs = soldSnap.docs.map(async (docSnap) => {
        try {
          const data    = docSnap.data();
          const soldAt  = data.soldAt as number | undefined;

          // If soldAt is missing or 0, stamp it now and skip until next run
          if (!soldAt) {
            await docSnap.ref.update({ soldAt: now });
            countStamped++;
            return;
          }

          // Not old enough yet
          if (now - soldAt < SEVEN_DAYS_MS) return;

          // ── Delete Storage photos ────────────────────────────────────────
          const photos: string[] = Array.isArray(data.photos) ? data.photos : [];
          for (const url of photos) {
            try {
              const match = url.match(/\/o\/(.+?)(\?|$)/);
              if (match && match[1]) {
                const storagePath = decodeURIComponent(match[1]);
                await admin.storage().bucket().file(storagePath).delete();
              }
            } catch (photoErr) {
              console.warn(
                `[dailySoldListingCleanup] failed to delete photo for listing ${docSnap.id}:`,
                photoErr
              );
            }
          }

          // ── Delete Firestore document ────────────────────────────────────
          await docSnap.ref.delete();
          countDeleted++;

          // ── Send in-app notification to owner ───────────────────────────
          const userId       = data.userId  as string | undefined;
          const listingTitle = data.title   as string | undefined;
          if (userId) {
            await sendNotification(userId, {
              type:     "listing_deleted",
              title:    "Listing Removed",
              body:     `Your listing "${listingTitle ?? "Untitled"}" was automatically removed 7 days after being marked as sold.`,
              shopId:   "",
              shopName: "",
            });
          }
        } catch (err) {
          console.error(
            `[dailySoldListingCleanup] error processing listing ${docSnap.id}:`,
            err
          );
          countErrors++;
        }
      });

      await Promise.allSettled(jobs);

      console.log(
        `[dailySoldListingCleanup] complete. ` +
        `Stamped: ${countStamped}. ` +
        `Deleted: ${countDeleted}. ` +
        `Errors: ${countErrors}.`
      );
    } catch (err) {
      console.error("[dailySoldListingCleanup] fatal error:", err);
    }

    return null;
  });
