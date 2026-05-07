/**
 * One-time migration: set sortKey = createdAt on all existing listings
 * that don't already have a sortKey field.
 *
 * Usage:
 *   1. Set FIREBASE_SERVICE_ACCOUNT env var (see guide below)
 *   2. node scripts/migrate-sort-key.mjs
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.error("❌  Missing FIREBASE_SERVICE_ACCOUNT environment variable.");
  console.error("    See the guide in the chat for how to set it.");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(raw);
} catch {
  console.error("❌  FIREBASE_SERVICE_ACCOUNT is not valid JSON.");
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function migrate() {
  console.log("🔍  Scanning listings collection…");
  const snap = await db.collection("listings").get();
  const docsToUpdate = snap.docs.filter((d) => d.data().sortKey === undefined);

  if (docsToUpdate.length === 0) {
    console.log("✅  Nothing to migrate — all listings already have sortKey.");
    return;
  }

  console.log(`📝  Found ${docsToUpdate.length} listing(s) without sortKey. Updating…`);

  // Firestore batch limit is 500 writes
  const BATCH_SIZE = 400;
  let count = 0;
  for (let i = 0; i < docsToUpdate.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docsToUpdate.slice(i, i + BATCH_SIZE);
    for (const doc of chunk) {
      const createdAt = doc.data().createdAt;
      // createdAt is a Firestore Timestamp — use its milliseconds value
      const sortKey = createdAt?.toMillis?.() ?? Date.now();
      batch.update(doc.ref, { sortKey });
      count++;
    }
    await batch.commit();
    console.log(`   committed ${count} / ${docsToUpdate.length}`);
  }

  console.log("✅  Migration complete!");
}

migrate().catch((err) => {
  console.error("❌  Migration failed:", err.message);
  process.exit(1);
});
