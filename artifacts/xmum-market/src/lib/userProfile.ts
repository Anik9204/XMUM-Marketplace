import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
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
import { deleteShopCompletely } from "./shops";

// Extract the Firebase Storage path from a full https:// download URL.
// ref(storage, fullUrl) only accepts gs:// or storage paths — passing a
// download URL to it throws. This helper extracts the encoded path portion
// so deleteObject works correctly.
function storagePathFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/o\/(.+?)(\?|$)/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

// Race against 6s timeout as a safety net in case of slow server response
// in Replit's proxy environment. (Offline persistence is disabled so writes
// fail fast, but network latency can still cause slow responses.)
// Rejects on timeout so callers know the operation did not complete.
function deleteDocWithTimeout(ref: Parameters<typeof deleteDoc>[0]): Promise<void> {
  return Promise.race([
    deleteDoc(ref),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("timeout:delete-doc")), 6_000)
    ),
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
  const profileSnap = await getDoc(doc(db, "users", uid));
  const oldAvatarUrl: string | undefined = profileSnap.data()?.avatarUrl;

  const ext = file.name.split(".").pop() ?? "jpg";
  const avatarRef = ref(storage, `avatars/${uid}/avatar.${ext}`);
  await uploadBytes(avatarRef, file);
  const url = await getDownloadURL(avatarRef);
  await updateDoc(doc(db, "users", uid), { avatarUrl: url });

  if (oldAvatarUrl) {
    try {
      const oldRef = ref(storage, decodeURIComponent(
        oldAvatarUrl.split("/o/")[1]?.split("?")[0] ?? ""
      ));
      await deleteObject(oldRef);
    } catch {
      // Silently ignore — old file may already be deleted or URL may be external
    }
  }

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

    // ── Step 1b: Check for listings under active report holds ───────────────────
    // Query listings directly (reports collection is not readable by regular users)
    console.log("[deleteAccount] Step 1b: Checking for report-held listings...");
    const heldSnap = await getDocs(
      query(collection(db, "listings"), where("userId", "==", uid), where("isReportHeld", "==", true), limit(1))
    );
    if (!heldSnap.empty) {
      throw Object.assign(
        new Error("You have listings that are currently under admin review due to reports. Please resolve these before deleting your account. Contact admin at cys2209204@xmu.edu.my"),
        { code: "report-hold-account" }
      );
    }
    console.log("[deleteAccount] Step 1b Complete — no held listings");

    // ── Step 2: Fetch profile now so we have avatarUrl before we delete the doc ─
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
        // Skip listings under a report hold — evidence must be preserved
        if (listingDoc.data().isReportHeld === true) return;

        const photos: string[] = listingDoc.data().photos ?? [];
        if (photos.length > 0) {
          await Promise.all(
            photos.map((url) => {
              const path = storagePathFromUrl(url);
              if (!path) return Promise.resolve();
              return deleteObject(ref(storage, path)).catch(() => {});
            })
          );
        }
        // Race against 6s timeout as a safety net in case of slow server response
        // in Replit's proxy environment. (Offline persistence is disabled so writes
        // fail fast, but network latency can still cause slow responses.)
        await deleteDocWithTimeout(listingDoc.ref);
      })
    );
    console.log("[deleteAccount] Step 4 Complete");

    // ── Step 4b: Delete owned shops and all their Storage media ───────────────
    console.log("[deleteAccount] Step 4b: Deleting owned shops and shop media...");
    const shopsSnap = await getDocs(
      query(collection(db, "shops"), where("ownerId", "==", uid))
    );
    for (const shopDoc of shopsSnap.docs) {
      try {
        await deleteShopCompletely(shopDoc.id);
      } catch (err) {
        console.error(`[deleteAccount] Step 4b: failed to delete shop ${shopDoc.id}:`, err);
        // Continue to next shop — never abort the whole deletion for one shop
      }
    }
    console.log("[deleteAccount] Step 4b Complete");

    // ── Step 5: Delete avatar from Storage ────────────────────────────────────
    console.log("[deleteAccount] Step 5: Deleting avatar from Storage...");
    if (profile?.avatarUrl) {
      const avatarPath = storagePathFromUrl(profile.avatarUrl);
      if (avatarPath) {
        await deleteObject(ref(storage, avatarPath)).catch(() => {});
      }
    }
    console.log("[deleteAccount] Step 5 Complete");

    // ── Step 6: Delete the Firestore user document ───────────────────────────
    console.log("[deleteAccount] Step 6: Deleting Firestore user doc...");
    try {
      await deleteDocWithTimeout(doc(db, "users", uid));
      console.log("[deleteAccount] Step 6 Complete");
    } catch (err) {
      console.warn("[deleteAccount] Step 6 Failed (continuing) — could not delete user doc:", err);
    }

    // ── Step 7: Delete the Firebase Auth account — MUST be last ──────────────
    console.log("[deleteAccount] Step 7: Deleting Firebase Auth user...");
    await deleteUser(user);
    console.log("[deleteAccount] Step 7 Complete — account fully deleted");

  } catch (err) {
    console.error("[deleteAccount] Fatal error:", err);
    throw err;
  }
}
