import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  Firestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const requiredEnvVars = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];
const missingVars = requiredEnvVars.filter(
  (key) => !import.meta.env[key as keyof ImportMeta["env"]]
);
if (missingVars.length > 0) {
  throw new Error(
    `[firebase] Missing required environment variables: ${missingVars.join(", ")}\n` +
    "Set these in Replit → Secrets (local dev) or deployment Settings → Environment Variables.\n" +
    "Required: " + requiredEnvVars.join(", ")
  );
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Singleton: reuse the app if HMR already initialised it
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Firestore with long-polling only (no offline persistence).
// Long-polling is required so Firestore works through Replit's proxy.
// Offline persistence is intentionally omitted so that writes either
// succeed on the server immediately or throw a real, visible error —
// this prevents the "queued locally, never synced" silent failure mode.
let db: Firestore;
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  db = getFirestore(app);
}
export { db };


export const storage = getStorage(app);
export default app;
