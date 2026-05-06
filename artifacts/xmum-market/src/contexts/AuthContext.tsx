import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { onAuthChange } from "@/lib/auth";
import { getProfile } from "@/lib/userProfile";
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

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const profile = await getProfile(uid);
      setUserProfile(profile);
    } catch {
      // Firestore may be offline on first load — silently return null.
      setUserProfile(null);
    }
  }, []);

  const refetchProfile = useCallback(async () => {
    if (!auth.currentUser?.uid) return;
    await fetchProfile(auth.currentUser.uid);
  }, [fetchProfile]);

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        await fetchProfile(u.uid);
      } else {
        setUserProfile(null);
        setAvatarOverride(null); // clear any in-flight preview on sign-out
      }
      setLoading(false);
    });
    return unsub;
  }, [fetchProfile]);

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
