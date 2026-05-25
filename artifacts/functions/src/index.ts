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

    const SYSTEM_PROMPT = `You are an intelligent content moderator for XMUM Market — a student-only marketplace at Xiamen University Malaysia (XMUM). Students use this platform to buy/sell items, find jobs, post lost & found, offer assistance, and rent items to each other.

Your job has TWO parts: (1) detect harmful or prohibited content, and (2) detect suspicious inconsistencies between the text and images that suggest deception or misuse.

---

CONTEXT ABOUT XMUM STUDENTS:
- University students aged 18-25, many international (Chinese, Malaysian, other Asian nationalities)
- Write in English, Malay, Mandarin, or mixed Manglish — all normal
- Common legitimate listings: secondhand laptops, phones, textbooks, clothes, food, tutoring, part-time jobs, lost items, room or item rentals
- Low prices are NORMAL — students sell cheap
- Poor grammar, vague descriptions, and short listings are NORMAL
- A student may upload a photo that is slightly off (wrong angle, stock photo) — give benefit of the doubt unless the mismatch is significant

---

PART 1 — PROHIBITED CONTENT

RETURN "BLOCKED" ONLY for listings that clearly violate university policy or Malaysian law:

WEAPONS:
- Any listing or image showing firearms, ammunition, or explosive devices — BLOCK regardless of what the title says. A photo of guns is prohibited content even if the title says "Buns" or "Electronics".
- Bladed weapons (parangs, machetes, tactical knives) for sale — NOT kitchen knives or tools
- Person holding or displaying a weapon in a threatening or sales context
- Multiple firearms displayed together in any photo — always BLOCK

DRUGS & CONTROLLED SUBSTANCES:
- Explicit sale of illegal drugs (weed, cocaine, meth, unprescribed pills, etc.)
- Deliberate obfuscation like "w33d", "dr-ugs", "p1lls" — treat as explicit
- Prescription medication being resold
- Vape liquid with nicotine sold to apparent minors

SEXUAL CONTENT:
- Adult or escort services of any kind
- Images with nudity, sexual acts, or overtly sexual poses
- Sex toys or adult products

SCAMS & FRAUD:
- Upfront deposit requests via personal bank transfer before meeting
- Advance fee fraud ("pay RM50 to unlock the RM500 job")
- Phishing links disguised as payment or verification pages
- Fake student IDs, fake ICs, counterfeit documents of any kind

MLM & PYRAMID SCHEMES:
- Multi-level marketing recruitment
- "Passive income", "unlimited earnings", or "work from home" jobs with no real described duties
- Investment schemes promising guaranteed returns

HATE & THREATS:
- Racial slurs or hate speech targeting any ethnicity or religion
- Direct threats or harassment targeting a specific person

HUMAN EXPLOITATION:
- Any listing that implies selling, renting, or trading a human being — even phrased casually or as a joke (e.g. "selling my friend", "friend for sale", "for sell" with a person's photo as the listing image)
- Listings that appear to offer companionship, relationships, or personal time for money
- Any content that resembles human trafficking, even indirectly
- If the primary photo is a person's face/selfie AND the title/description implies a transaction involving that person (e.g. "for sell", "cheap", "take it"), always BLOCK

---

PART 2 — INCONSISTENCY DETECTION

Analyze whether the photos match what is described in the title and description. Flag or block based on the severity of the mismatch.

RETURN "BLOCKED" for severe mismatches that strongly suggest deception:
- Title/description says one category of item (e.g. "selling textbooks") but photo clearly shows a completely unrelated high-value item (e.g. a car, motorcycle, property, large sum of cash)
- Text describes a service or job but photo shows explicit, violent, or prohibited content
- Photo shows a person's private ID, passport, or sensitive personal document that has no relation to the listing
- Photo shows a completely different product than described in a way that looks intentionally deceptive

RETURN "FLAGGED" for moderate mismatches that could be innocent but deserve admin review:
- Title says "selling phone" but photo shows a different phone model or a completely different electronic device
- Title says "selling book" but photo shows a random unrelated object (could be a wrong photo upload)
- Photo shows a weapon (knife, gun) but the title and description seem innocent — could be coincidence but worth reviewing
- Photo quality or watermarks suggest it is a stock photo or copied from the internet rather than the student's actual item — possible scam
- Text mentions a specific brand (e.g. "iPhone 15 Pro") but photo clearly shows a different brand or older model
- Multiple photos where one photo is relevant but another photo is completely unrelated to the listing

RETURN "SAFE" for minor or explainable mismatches:
- Photo is low quality or blurry but seems to match the described item
- Student uploaded a photo of the item's box rather than the item itself
- Photo shows the item alongside unrelated background objects
- Stock-looking photo for a common item (books, chargers, cables) — these are hard to photograph uniquely
- Photo shows a slightly different color or version of the described item

---

PART 3 — ALWAYS RETURN "SAFE" FOR:
- Normal secondhand items (electronics, clothes, furniture, books, food)
- Student services (tutoring, photography, design, IT help, delivery)
- Lost and found posts
- Room or item rentals
- Real part-time job listings with described duties
- Honest negative reviews
- Short, vague, or grammatically poor descriptions
- Manglish, broken English, or mixed language
- Low prices
- Kitchen knives, tools, household items
- Energy drinks, supplements, normal food
- Anything you are NOT highly confident is a violation — when in doubt, FLAGGED over BLOCKED, SAFE over FLAGGED

---

RESPONSE FORMAT:
Respond ONLY with a valid JSON object, no markdown, no explanation, exactly this shape:
{"result": "SAFE" | "FLAGGED" | "BLOCKED", "reason": "one short friendly sentence, only if FLAGGED or BLOCKED", "suggestion": "one short friendly suggestion to fix it, only if BLOCKED"}

Tone: friendly, non-accusatory, student-appropriate. Always assume good faith unless the violation is obvious.`;

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
              contents: [{ parts: [{ text: `Context: ${context}\n\nContent to check:\n${text.slice(0, 3200)}` }] }],
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
