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
  return getDownloadURL(avatarRef);
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
  const user = auth.currentUser;
  if (!user?.email) throw new Error("no-user");

  // Step 1: Re-authenticate — must succeed before any destructive action
  const cred = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, cred);

  const uid = user.uid;

  // Step 2: Fetch profile now (before we delete the doc) so we have avatarUrl
  const profile = await getProfile(uid);

  // Step 3: Query ALL listings for this user (archived or not)
  const listingsSnap = await getDocs(
    query(collection(db, "listings"), where("userId", "==", uid))
  );

  // Step 4: For each listing — delete Storage photos first, then Firestore doc
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
      await deleteDoc(listingDoc.ref);
    })
  );

  // Step 5: Delete avatar from Storage (silently skip if it doesn't exist)
  if (profile?.avatarUrl) {
    await deleteObject(ref(storage, profile.avatarUrl)).catch((err) => {
      if (err?.code !== "storage/object-not-found") throw err;
    });
  }

  // Step 6: Delete the Firestore user document
  await deleteDoc(doc(db, "users", uid));

  // Step 7: Delete the Firebase Auth account — must be LAST
  await deleteUser(user);
}
