import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  Firestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Singleton: reuse the app if HMR already initialised it
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Offline persistence: addDoc resolves immediately from local IndexedDB cache
// and syncs to the server in the background, preventing UI hangs.
// initializeFirestore can only be called once per app; getFirestore is the
// safe fallback when HMR re-executes this module.
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager({ forceOwnership: true }),
    }),
    // Force long polling so Firestore works through proxies (e.g. Replit)
    // that block or drop WebSocket connections.
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  db = getFirestore(app);
}
export { db };

export const storage = getStorage(app);
export default app;
