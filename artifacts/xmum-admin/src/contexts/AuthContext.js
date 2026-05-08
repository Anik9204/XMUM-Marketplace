import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
const Ctx = createContext({ user: null, adminUser: null,
    isAdmin: false, isEditor: false, loading: true });
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [adminUser, setAdminUser] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        return onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                try {
                    const snap = await getDoc(doc(db, "users", u.uid));
                    if (snap.exists()) {
                        setAdminUser({ uid: u.uid, ...snap.data() });
                    }
                }
                catch {
                    setAdminUser(null);
                }
            }
            else {
                setAdminUser(null);
            }
            setLoading(false);
        });
    }, []);
    const isAdmin = adminUser?.role === "admin";
    const isEditor = adminUser?.role === "editor" || adminUser?.role === "admin";
    return (_jsx(Ctx.Provider, { value: { user, adminUser, isAdmin, isEditor, loading }, children: children }));
}
export const useAuth = () => useContext(Ctx);
