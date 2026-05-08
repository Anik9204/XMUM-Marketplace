import { useEffect, useState } from "react";
import { collection, getDocs, updateDoc, doc, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { AdminUser, UserRole } from "../lib/types";
import { Ban, CheckCircle, CheckCircle2 } from "lucide-react";

function Toast({ message, type, onDone }: { message: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl
                     shadow-lg text-sm font-medium flex items-center gap-2 animate-in
                     ${type === "success"
                       ? "bg-green-600 text-white"
                       : "bg-red-600 text-white"}`}>
      {type === "success" ? <CheckCircle2 className="w-4 h-4" /> : null}
      {message}
    </div>
  );
}

export default function UsersPage() {
  const { adminUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(
          query(collection(db, "users"), orderBy("createdAt", "desc"))
        );
        setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as AdminUser)));
      } catch {
        const snap = await getDocs(collection(db, "users"));
        setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as AdminUser)));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function updateUser(uid: string, data: Partial<AdminUser>) {
    if (!isAdmin && "role" in data) return;
    if (uid === adminUser?.uid && "role" in data) return;
    try {
      await Promise.race([
        updateDoc(doc(db, "users", uid), data as any),
        new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 6000)),
      ]);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...data } : u));
      setToast({ message: "Change saved.", type: "success" });
    } catch (e) {
      console.error("[UsersPage] updateUser failed:", e);
      setToast({ message: "Failed to save. Check the console.", type: "error" });
    }
  }

  function handleRoleChange(u: AdminUser, newRole: UserRole) {
    if (!window.confirm(`Change ${u.email}'s role to "${newRole}"?`)) return;
    updateUser(u.uid, { role: newRole });
  }

  function handleBanToggle(u: AdminUser) {
    const action = u.isBlacklisted ? "unban" : "ban";
    if (!window.confirm(`Are you sure you want to ${action} ${u.email}?`)) return;
    updateUser(u.uid, { isBlacklisted: !u.isBlacklisted });
  }

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const ROLE_OPTIONS: UserRole[] = ["user", "editor", "admin"];

  return (
    <div className="p-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}

      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">Users</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {users.length} total accounts
        </p>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
             placeholder="Search by name or email…"
             className="w-full max-w-md bg-white dark:bg-slate-800 border border-gray-200
                        dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm min-h-[44px]
                        focus:outline-none focus:ring-2 focus:ring-blue-500 mb-5
                        text-slate-800 dark:text-slate-200" />

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white dark:bg-slate-800 rounded-2xl
                                    animate-pulse border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100
                        dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400
                                 uppercase tracking-wide">User</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400
                                 uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400
                                 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400
                                 uppercase tracking-wide">Joined</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400
                                 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {filtered.map(u => (
                  <tr key={u.uid}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {u.displayName || "—"}
                      </p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && u.uid !== adminUser?.uid ? (
                        <select
                          value={u.role || "user"}
                          onChange={e => handleRoleChange(u, e.target.value as UserRole)}
                          className="bg-slate-50 dark:bg-slate-700 border border-gray-200
                                     dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs
                                     text-slate-700 dark:text-slate-300 min-h-[36px]">
                          {ROLE_OPTIONS.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs font-medium capitalize px-2 py-1 rounded-full
                          ${u.role === "admin"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                            : u.role === "editor"
                            ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
                          {u.role || "user"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.isBlacklisted
                        ? <span className="text-xs text-red-500 font-medium">Banned</span>
                        : <span className="text-xs text-green-500 font-medium">Active</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString("en-MY", {
                            month: "short", year: "numeric", day: "numeric"
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {u.uid !== adminUser?.uid && (
                        <button
                          onClick={() => handleBanToggle(u)}
                          className={`flex items-center gap-1.5 text-xs rounded-xl px-3 py-1.5
                                      border min-h-[36px] transition-colors
                                      ${u.isBlacklisted
                                        ? "border-green-200 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                        : "border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"}`}>
                          {u.isBlacklisted
                            ? <><CheckCircle className="w-3 h-3" /> Unban</>
                            : <><Ban className="w-3 h-3" /> Ban</>}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
