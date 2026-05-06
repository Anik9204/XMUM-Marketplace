import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { UserProfile } from "./types";

export const XMU_DOMAIN = "@xmu.edu.my";

export function isXmuEmail(email: string): boolean {
  return email.toLowerCase().endsWith(XMU_DOMAIN);
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  whatsapp?: string,
  wechat?: string
): Promise<User> {
  if (!isXmuEmail(email)) {
    throw new Error("only_xmu_email");
  }
  // Critical path: create account + send verification email
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(cred.user);

  // Non-blocking: write user profile to Firestore in the background.
  // If Firestore isn't set up yet this must NOT block or throw — the auth
  // flow has already succeeded and the verification email has been sent.
  setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    email: cred.user.email ?? "",
    displayName: email.split("@")[0],
    fullName: fullName.trim(),
    avatarUrl: "",
    whatsapp: whatsapp?.trim() ?? "",
    wechat: wechat?.trim() ?? "",
    emailVerified: false,
    isVerified: false,
    rating: 0,
    isBlacklisted: false,
    isFeatured: false,
    showEmail: true,
    showWhatsApp: true,
    showWeChat: true,
    createdAt: Date.now(),
  } satisfies UserProfile).catch((err) => {
    console.warn("[signUp] Firestore user profile write failed (non-fatal):", err?.code, err?.message);
  });

  return cred.user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function resendVerification(): Promise<void> {
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export function onAuthChange(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}
