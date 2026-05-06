import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  updatePassword as fbUpdatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage, auth } from "./firebase";
import { UserProfile } from "./types";

// Firestore with offline persistence can block deleteDoc indefinitely when
// the server ACK is slow. Race every doc delete against a 6-second resolve
// so the sequence never hangs — the SDK will continue syncing in the background.
function deleteDocWithTimeout(ref: Parameters<typeof deleteDoc>[0]): Promise<void> {
  return Promise.race([
    deleteDoc(ref),
    new Promise<void>((resolve) => setTimeout(resolve, 6_000)),
  ]);
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function updateProfile(
  uid: string,
  data: Partial<Omit<UserProfile, "uid" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, "users", uid), data as Record<string, unknown>);
}

export async function uploadAvatar(file: File, uid: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const avatarRef = ref(storage, `avatars/${uid}/avatar.${ext}`);
  await uploadBytes(avatarRef, file);
  const url = await getDownloadURL(avatarRef);
  // Write the download URL back to Firestore immediately using updateDoc
  // (merge-safe — does NOT overwrite other fields like whatsapp, wechat, etc.)
  await updateDoc(doc(db, "users", uid), { avatarUrl: url });
  return url;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("no-user");
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred);
  await fbUpdatePassword(user, newPassword);
}

export async function deleteAccount(password: string): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user?.email) throw new Error("no-user");

    // ── Step 1: Re-authenticate with EmailAuthProvider ─────────────────────────
    console.log("[deleteAccount] Step 1: Re-authenticating...");
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
    console.log("[deleteAccount] Step 1 Complete");

    const uid = user.uid;

    // ── Step 2: Fetch profile now so we have avatarUrl before we delete the doc ─
    // Non-critical: if Firestore is offline the avatar simply won't be deleted
    // from Storage, but the Auth account and all other data still will be.
    console.log("[deleteAccount] Step 2: Fetching profile...");
    let profile: UserProfile | null = null;
    try {
      profile = await getProfile(uid);
      console.log("[deleteAccount] Step 2 Complete");
    } catch (err) {
      console.warn("[deleteAccount] Step 2 Failed (continuing) — could not fetch profile:", err);
    }

    // ── Step 3: Query ALL listings for this user (archived or not) ─────────────
    console.log("[deleteAccount] Step 3: Querying listings...");
    const listingsSnap = await getDocs(
      query(collection(db, "listings"), where("userId", "==", uid))
    );
    console.log(`[deleteAccount] Step 3 Complete — ${listingsSnap.docs.length} listing(s) found`);

    // ── Step 4: For each listing — delete Storage photos first, then Firestore doc
    console.log("[deleteAccount] Step 4: Deleting listing photos and docs...");
    await Promise.all(
      listingsSnap.docs.map(async (listingDoc) => {
        const photos: string[] = listingDoc.data().photos ?? [];
        if (photos.length > 0) {
          await Promise.all(
            photos.map((url) =>
              deleteObject(ref(storage, url)).catch((err) => {
                if (err?.code !== "storage/object-not-found") throw err;
              })
            )
          );
        }
        // Race against 6s timeout — offline persistence can block indefinitely
        await deleteDocWithTimeout(listingDoc.ref);
      })
    );
    console.log("[deleteAccount] Step 4 Complete");

    // ── Step 5: Delete avatar from Storage ────────────────────────────────────
    console.log("[deleteAccount] Step 5: Deleting avatar from Storage...");
    if (profile?.avatarUrl) {
      await deleteObject(ref(storage, profile.avatarUrl)).catch((err) => {
        if (err?.code !== "storage/object-not-found") throw err;
      });
    }
    console.log("[deleteAccount] Step 5 Complete");

    // ── Step 6: Delete the Firestore user document ───────────────────────────
    // Non-critical: if Firestore is offline this doc may linger, but the Auth
    // account is still deleted in Step 7 so the user cannot log back in.
    // Orphaned docs can be cleaned up server-side later.
    console.log("[deleteAccount] Step 6: Deleting Firestore user doc...");
    try {
      await deleteDocWithTimeout(doc(db, "users", uid));
      console.log("[deleteAccount] Step 6 Complete");
    } catch (err) {
      console.warn("[deleteAccount] Step 6 Failed (continuing) — could not delete user doc:", err);
    }

    // ── Step 7: Delete the Firebase Auth account — MUST be last ──────────────
    // Deleting the Auth user fires onAuthStateChanged(null) which triggers a
    // React re-render. The UI must handle user===null gracefully at this point.
    console.log("[deleteAccount] Step 7: Deleting Firebase Auth user...");
    await deleteUser(user);
    console.log("[deleteAccount] Step 7 Complete — account fully deleted");

  } catch (err) {
    console.error("[deleteAccount] Fatal error:", err);
    throw err;
  }
}
