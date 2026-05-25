import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as vision from "@google-cloud/vision";

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

export const dailySubscriptionCheck = onSchedule(
  { schedule: "0 8 * * *", timeZone: "Asia/Kuala_Lumpur", region: "asia-southeast1" },
  async () => {
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
  });

// ── Scheduled function — runs daily at 03:00 Malaysia time ───────────────────

export const dailySoldListingCleanup = onSchedule(
  { schedule: "0 3 * * *", timeZone: "Asia/Kuala_Lumpur", region: "asia-southeast1" },
  async () => {
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
  });

// ── HTTPS Callable — AI content moderation (text + images) ───────────────────

export const moderateContent = onCall(
  {
    region: "asia-southeast1",
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 30,
    invoker: "public",
    cors: [
      "https://www.xmummarket.com",
      "https://xmummarket.com",
      "https://admin.xmummarket.com",
      /https:\/\/xmum-marketplace.*\.vercel\.app$/,
      "http://localhost:5000",
      "http://localhost:5001",
    ],
  },
  async (request) => {
    const { text, context, photoUrls = [] } = request.data as {
      text: string;
      context: string;
      photoUrls?: string[];
    };

    if (!text || text.trim().length < 3) {
      return { result: "SAFE", reason: "", suggestion: "" };
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";

    const SYSTEM_PROMPT = `You are a content moderator for XMUM Market — a student-only marketplace at Xiamen University Malaysia (XMUM). Students use this platform to buy/sell items, find jobs, post lost & found, offer assistance, and rent items to each other.

Your job is to protect the student community while being fair and not over-blocking legitimate student activity.

---

CONTEXT ABOUT XMUM STUDENTS:
- They are university students aged 18-25
- Many are international students (Chinese, Malaysian, other Asian nationalities)
- They write in English, Malay, Mandarin, or a mix (Manglish is normal)
- Common legitimate listings: secondhand laptops, phones, textbooks, clothes, food, tutoring, part-time jobs, lost items, rental of rooms/items
- Low prices are NORMAL — students sell cheap
- Poor grammar, vague descriptions, and short listings are NORMAL

---

RETURN "BLOCKED" ONLY for listings that clearly violate university or Malaysian law:

WEAPONS:
- Any listing or image that shows or describes firearms, ammunition, or explosive devices for sale
- Bladed weapons (parangs, machetes, tactical knives) offered for sale — NOT kitchen knives or tools
- Images showing a person holding or displaying a weapon in a threatening way

DRUGS & CONTROLLED SUBSTANCES:
- Explicit sale of illegal drugs (weed, cocaine, meth, pills not prescribed to seller, etc.)
- Deliberate obfuscation like "w33d", "dr-ugs", "p1lls" — treat these as explicit
- Prescription medication being sold (any listing selling medication they were prescribed)
- Vape/e-cigarette liquid containing nicotine salts sold to apparent minors

SEXUAL CONTENT:
- Adult services, escort services, or sexual content of any kind
- Images containing nudity, sexual acts, or overtly sexual poses
- Sex toys or adult products

SCAMS & FRAUD:
- Requests for upfront deposits via personal bank transfer before meeting
- Advance fee fraud patterns ("pay RM50 to unlock the RM500 job")
- Phishing links disguised as payment or verification pages
- Fake student IDs, fake ICs, counterfeit documents

MLM & PYRAMID SCHEMES:
- Recruitment into multi-level marketing
- "Passive income" or "work from home unlimited earnings" job posts with no real job description
- Investment schemes promising guaranteed returns

EXTREMELY OFFENSIVE CONTENT:
- Racial slurs or hate speech targeting any ethnicity or religion
- Content that directly threatens or harasses a specific person

---

RETURN "FLAGGED" for listings that are suspicious but not certain violations (post goes through but admin reviews):

- Job listings with vague descriptions and unusually high pay (e.g. "earn RM800/day, flexible hours, no experience needed, WhatsApp me")
- Items priced suspiciously low in a way that suggests fraud, NOT just student discounts (e.g. MacBook Pro 2023 for RM100)
- Images showing weapons as part of the listing photo even if text seems innocent (e.g. photo of a knife or gun with title "selling old stuff")
- Listings that mention controlled items ambiguously (e.g. "selling herbs" with suspicious context)
- Multiple contact methods pushing strongly toward one private payment channel
- Listings that seem to be recruiting for something rather than selling a product or service

---

RETURN "SAFE" for everything else, including:

- Normal secondhand items (electronics, clothes, furniture, books, food)
- Tutoring, photography, design, IT help, delivery, and other student services
- Lost and found posts
- Room or item rentals
- Part-time job listings with real described duties
- Negative but honest reviews
- Short, vague, or grammatically poor descriptions
- Manglish, broken English, or mixed language posts
- Low prices (student selling cheap is completely normal)
- Kitchen knives, tools, or household items
- Energy drinks, supplements, or normal food items
- Anything you are NOT highly confident is a violation — when in doubt, choose SAFE or FLAGGED over BLOCKED

---

RESPONSE FORMAT:
Respond ONLY with a valid JSON object, no markdown, no explanation:
{"result": "SAFE" | "FLAGGED" | "BLOCKED", "reason": "one short friendly sentence explaining why, only if FLAGGED or BLOCKED", "suggestion": "one short friendly suggestion to fix it, only if BLOCKED"}

Keep the reason and suggestion friendly and student-appropriate. Never be accusatory — assume good faith unless the violation is obvious.`;

    // ── 1. Text moderation via Gemini ─────────────────────────────
    let textResult: { result: string; reason: string; suggestion: string } = {
      result: "SAFE", reason: "", suggestion: "",
    };

    if (GEMINI_API_KEY) {
      try {
        const geminiRes = await fetch(
          `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ parts: [{ text: `Context: ${context}\n\nContent to check:\n${text.slice(0, 1500)}` }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 120,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          try {
            const parsed = JSON.parse(raw);
            if (["SAFE", "FLAGGED", "BLOCKED"].includes(parsed.result)) {
              textResult = {
                result: parsed.result,
                reason: parsed.reason ?? "",
                suggestion: parsed.suggestion ?? "",
              };
            }
          } catch { /* keep SAFE */ }
        } else if (geminiRes.status === 429) {
          textResult = {
            result: "BLOCKED",
            reason: "Our content check is temporarily busy. Please wait a moment and try again.",
            suggestion: "Wait 30 seconds and resubmit your listing.",
          };
        }
      } catch { /* fail open */ }
    }

    // If text is already BLOCKED, return immediately — skip image scan
    if (textResult.result === "BLOCKED") {
      return textResult;
    }

    // ── 2. Image moderation via Cloud Vision SafeSearch ──────────
    let imageResult: { result: string; reason: string; suggestion: string } = {
      result: "SAFE", reason: "", suggestion: "",
    };

    const urlsToCheck = (photoUrls as string[]).slice(0, 5);
    if (urlsToCheck.length > 0) {
      try {
        const visionClient = new vision.ImageAnnotatorClient();
        const checks = urlsToCheck.map((url) =>
          visionClient.safeSearchDetection(url).catch(() => [null])
        );
        const results = await Promise.all(checks);

        const LIKELY = new Set(["LIKELY", "VERY_LIKELY"]);
        const POSSIBLE = new Set(["POSSIBLE"]);

        for (const [response] of results) {
          if (!response) continue;
          const s = (response as any).safeSearchAnnotation;
          if (!s) continue;

          const hasViolation = LIKELY.has(s.adult) || LIKELY.has(s.violence) || LIKELY.has(s.racy);
          const hasPossible = POSSIBLE.has(s.adult) || POSSIBLE.has(s.violence) || POSSIBLE.has(s.racy);

          if (hasViolation) {
            imageResult = {
              result: "BLOCKED",
              reason: "One or more photos contain inappropriate content that violates our community guidelines.",
              suggestion: "Please remove the flagged photo and replace it with an appropriate one.",
            };
            break;
          }
          if (hasPossible && imageResult.result !== "BLOCKED") {
            imageResult = {
              result: "FLAGGED",
              reason: "One or more photos may contain inappropriate content and will be reviewed by our team.",
              suggestion: "",
            };
          }
        }
      } catch (err) {
        console.warn("[moderateContent] Vision SafeSearch failed, skipping:", err);
        // fail open — do not block if Vision is unavailable
      }
    }

    // ── 3. Return worst result of text + image ────────────────────
    const rank: Record<string, number> = { SAFE: 0, FLAGGED: 1, BLOCKED: 2 };
    if ((rank[imageResult.result] ?? 0) > (rank[textResult.result] ?? 0)) {
      return imageResult;
    }
    return textResult;
  }
);
