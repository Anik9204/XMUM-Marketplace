import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { AdminUser } from "../lib/types";

interface AuthCtx {
  user: User | null;
  adminUser: AdminUser | null;
  isAdmin: boolean;
  isEditor: boolean;
  loading: boolean;
}

const Ctx = createContext<AuthCtx>({ user: null, adminUser: null,
  isAdmin: false, isEditor: false, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            setAdminUser({ uid: u.uid, ...snap.data() } as AdminUser);
          }
        } catch { setAdminUser(null); }
      } else {
        setAdminUser(null);
      }
      setLoading(false);
    });
  }, []);

  const isAdmin  = adminUser?.role === "admin";
  const isEditor = adminUser?.role === "editor" || adminUser?.role === "admin";

  return (
    <Ctx.Provider value={{ user, adminUser, isAdmin, isEditor, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
