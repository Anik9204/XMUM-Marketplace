import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  updatePassword as fbUpdatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
