import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "firebase/auth";
import { onSnapshot, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthChange } from "@/lib/auth";
import { UserProfile } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  refetchProfile: () => Promise<void>;
  /** Temporary local object URL shown while an avatar upload is in flight.
   *  Set to a createObjectURL() result before uploading; clear to null after
   *  refetchProfile() completes so the real Firestore URL takes over. */
  avatarOverride: string | null;
  setAvatarOverride: (url: string | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userProfile: null,
  loading: true,
  refetchProfile: async () => {},
  avatarOverride: null,
  setAvatarOverride: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  // Tick forces a re-render after reload() mutates the User object in-place.
  // Firebase does NOT create a new User reference on reload(), so React won't
  // detect the emailVerified change without this nudge.
  const [, setTick] = useState(0);

  const refetchProfile = useCallback(async () => {
    // onSnapshot keeps the profile in real-time sync automatically
  }, []);

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthChange((u) => {
      setUser(u);
      if (profileUnsub) { profileUnsub(); profileUnsub = null; }

      if (u) {
        // Delay setLoading(false) until the first profile snapshot fires so
        // consumers never see loading=false with userProfile still null.
        let firstSnap = true;
        profileUnsub = onSnapshot(
          doc(db, "users", u.uid),
          (snap) => {
            setUserProfile(snap.exists() ? (snap.data() as UserProfile) : null);
            if (firstSnap) { firstSnap = false; setLoading(false); }
            // Change 1: sync emailVerified from Auth → Firestore when it lags behind
            if (u.emailVerified && snap.exists() && !snap.data().emailVerified) {
              updateDoc(doc(db, "users", u.uid), { emailVerified: true }).catch(() => {});
            }
          },
          () => {
            setUserProfile(null);
            if (firstSnap) { firstSnap = false; setLoading(false); }
          }
        );
      } else {
        setUserProfile(null);
        setAvatarOverride(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  // Poll only when a user is signed in but unverified.
  // Stops automatically once emailVerified flips to true.
  useEffect(() => {
    if (!user || user.emailVerified) return;

    const check = async () => {
      try {
        await auth.currentUser?.reload();
        if (auth.currentUser?.emailVerified) {
          // Mutated in-place — nudge React to re-read the object
          setTick((t) => t + 1);
          // Change 2: sync emailVerified to Firestore as soon as reload() confirms it
          const uid = auth.currentUser.uid;
          updateDoc(doc(db, "users", uid), { emailVerified: true }).catch(() => {});
        }
      } catch {
        // Network hiccups are fine — wait for next poll
      }
    };

    const interval = setInterval(check, 3000);
    window.addEventListener("focus", check);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", check);
    };
  }, [user, user?.emailVerified]);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, refetchProfile, avatarOverride, setAvatarOverride }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
