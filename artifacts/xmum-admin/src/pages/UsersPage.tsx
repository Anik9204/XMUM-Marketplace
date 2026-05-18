import { useEffect, useState } from "react";
import { collection, updateDoc, doc, orderBy, query, onSnapshot, getDocs, where } from "firebase/firestore";
import { db, writeAuditLog } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { AdminUser, UserRole } from "../lib/types";
import { Ban, CheckCircle, CheckCircle2, X, ExternalLink } from "lucide-react";

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

const MAIN_APP_URL = import.meta.env.VITE_MAIN_APP_URL ?? "";

export default function UsersPage() {
  const { adminUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "editor" | "user" | "banned">("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [drawerStats, setDrawerStats] = useState<{
    listingCount: number;
    reportCount: number;
  } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  useEffect(() => {
    let q;
    try {
      q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    } catch {
      q = collection(db, "users");
    }
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as AdminUser)));
        setLoading(false);
      },
      (err) => {
        console.error("[UsersPage] snapshot error:", err);
        setLoading(false);
      }
    );
    return unsub;
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
      const targetUser = users.find((u) => u.uid === uid);
      const auditAction = "role" in data
        ? "user_role_changed"
        : (data as any).isBlacklisted ? "user_banned" : "user_unbanned";
      const auditLabel = "role" in data
        ? `Changed ${targetUser?.email ?? uid}'s role to "${(data as any).role}"`
        : (data as any).isBlacklisted
          ? `Banned user ${targetUser?.email ?? uid}`
          : `Unbanned user ${targetUser?.email ?? uid}`;
      void writeAuditLog({
        actorUid:    adminUser?.uid   ?? "",
        actorEmail:  adminUser?.email ?? "",
        action:      auditAction,
        label:       auditLabel,
        targetId:    uid,
        targetType:  "user",
        targetLabel: targetUser?.email ?? uid,
        createdAt:   Date.now(),
      });
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

  async function openDrawer(u: AdminUser) {
    setSelectedUser(u);
    setDrawerStats(null);
    setDrawerLoading(true);
    try {
      const [listingsSnap, reportsSnap] = await Promise.all([
        getDocs(query(collection(db, "listings"),
          where("userId", "==", u.uid),
          where("isArchived", "==", false)
        )),
        getDocs(query(collection(db, "reports"),
          where("listingUserId", "==", u.uid)
        )),
      ]);
      setDrawerStats({
        listingCount: listingsSnap.size,
        reportCount: reportsSnap.size,
      });
    } catch (err) {
      console.error("[UsersPage] drawer stats failed:", err);
      setDrawerStats({ listingCount: 0, reportCount: 0 });
    } finally {
      setDrawerLoading(false);
    }
  }

  const filtered = users.filter(u => {
    const matchesSearch = !search.trim() ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName?.toLowerCase().includes(search.toLowerCase());
    const matchesRole =
      roleFilter === "all" ? true :
      roleFilter === "banned" ? u.isBlacklisted :
      u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

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

      <div className="flex flex-wrap gap-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)}
               placeholder="Search by name or email…"
               className="w-full max-w-md bg-white dark:bg-slate-800 border border-gray-200
                          dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm min-h-[44px]
                          focus:outline-none focus:ring-2 focus:ring-blue-500
                          text-slate-800 dark:text-slate-200" />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value as typeof roleFilter)}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                     rounded-xl px-3 py-2.5 text-sm min-h-[44px] text-slate-700
                     dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Users</option>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="user">User</option>
          <option value="banned">Banned</option>
        </select>
      </div>

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
                      onClick={() => openDrawer(u)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer">
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
                          onClick={e => e.stopPropagation()}
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
                      <div className="flex items-center gap-1.5">
                        {u.uid !== adminUser?.uid && (
                          <button
                            onClick={e => { e.stopPropagation(); handleBanToggle(u); }}
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
                        <a
                          href={`${MAIN_APP_URL}/seller/${u.uid}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-blue-600
                                     dark:text-blue-400 border border-blue-200
                                     dark:border-blue-800 rounded-lg px-2.5 py-1.5
                                     hover:bg-blue-50 dark:hover:bg-blue-900/20
                                     transition-colors min-h-[32px]"
                          title="View public profile"
                        >
                          <ExternalLink className="w-3 h-3" /> Profile
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30 dark:bg-black/50"
            onClick={() => setSelectedUser(null)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-800
                          h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b
                            border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40
                                flex items-center justify-center flex-shrink-0 text-blue-600
                                dark:text-blue-400 font-bold text-sm">
                  {(selectedUser.displayName ?? selectedUser.email ?? "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {selectedUser.displayName ?? "—"}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-700
                           dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 px-5 py-5 space-y-5">
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs font-medium capitalize px-2.5 py-1 rounded-full ${
                  selectedUser.role === "admin"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                    : selectedUser.role === "editor"
                    ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                }`}>
                  {selectedUser.role ?? "user"}
                </span>
                {selectedUser.isBlacklisted && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full
                                   bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    Banned
                  </span>
                )}
                {selectedUser.verificationStatus === "approved" && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full
                                   bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                    XMUM Verified
                  </span>
                )}
                {selectedUser.verificationStatus === "pending" && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full
                                   bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                    Verification Pending
                  </span>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">UID</span>
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-300
                                   truncate max-w-[180px]">{selectedUser.uid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Joined</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {selectedUser.createdAt
                      ? new Date(selectedUser.createdAt).toLocaleDateString("en-MY", {
                          day: "numeric", month: "short", year: "numeric"
                        })
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Email verified</span>
                  <span className={selectedUser.emailVerified
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-500"}>
                    {selectedUser.emailVerified ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                  {drawerLoading ? (
                    <div className="h-6 bg-slate-200 dark:bg-slate-600 rounded animate-pulse mx-auto w-8 mb-1" />
                  ) : (
                    <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
                      {drawerStats?.listingCount ?? "—"}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Active Listings</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
                  {drawerLoading ? (
                    <div className="h-6 bg-slate-200 dark:bg-slate-600 rounded animate-pulse mx-auto w-8 mb-1" />
                  ) : (
                    <p className={`text-xl font-bold ${
                      (drawerStats?.reportCount ?? 0) > 0
                        ? "text-red-500"
                        : "text-slate-800 dark:text-slate-200"
                    }`}>
                      {drawerStats?.reportCount ?? "—"}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Reports Against</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Actions
                </p>
                {selectedUser.uid !== adminUser?.uid && (
                  <button
                    onClick={() => {
                      handleBanToggle(selectedUser);
                      setSelectedUser(null);
                    }}
                    className={`w-full flex items-center justify-center gap-2 text-sm font-medium
                                rounded-xl min-h-[44px] border transition-colors
                                ${selectedUser.isBlacklisted
                                  ? "border-green-200 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                  : "border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"}`}
                  >
                    {selectedUser.isBlacklisted ? "Unban User" : "Ban User"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
