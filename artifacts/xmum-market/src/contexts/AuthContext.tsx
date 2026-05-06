import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { onAuthChange } from "@/lib/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Tick forces a re-render after reload() mutates the User object in-place.
  // Firebase does NOT create a new User reference on reload(), so React won't
  // detect the emailVerified change without this nudge.
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
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
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
