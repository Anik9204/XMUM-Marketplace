import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { collection, updateDoc, doc, orderBy, query, onSnapshot, getDocs, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Ban, CheckCircle, CheckCircle2, X } from "lucide-react";
function Toast({ message, type, onDone }) {
    useEffect(() => {
        const t = setTimeout(onDone, 3000);
        return () => clearTimeout(t);
    }, [onDone]);
    return (_jsxs("div", { className: `fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl
                     shadow-lg text-sm font-medium flex items-center gap-2 animate-in
                     ${type === "success"
            ? "bg-green-600 text-white"
            : "bg-red-600 text-white"}`, children: [type === "success" ? _jsx(CheckCircle2, { className: "w-4 h-4" }) : null, message] }));
}
export default function UsersPage() {
    const { adminUser, isAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [roleFilter, setRoleFilter] = useState("all");
    const [selectedUser, setSelectedUser] = useState(null);
    const [drawerStats, setDrawerStats] = useState(null);
    const [drawerLoading, setDrawerLoading] = useState(false);
    useEffect(() => {
        let q;
        try {
            q = query(collection(db, "users"), orderBy("createdAt", "desc"));
        }
        catch {
            q = collection(db, "users");
        }
        const unsub = onSnapshot(q, (snap) => {
            setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error("[UsersPage] snapshot error:", err);
            setLoading(false);
        });
        return unsub;
    }, []);
    async function updateUser(uid, data) {
        if (!isAdmin && "role" in data)
            return;
        if (uid === adminUser?.uid && "role" in data)
            return;
        try {
            await Promise.race([
                updateDoc(doc(db, "users", uid), data),
                new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 6000)),
            ]);
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...data } : u));
            setToast({ message: "Change saved.", type: "success" });
        }
        catch (e) {
            console.error("[UsersPage] updateUser failed:", e);
            setToast({ message: "Failed to save. Check the console.", type: "error" });
        }
    }
    function handleRoleChange(u, newRole) {
        if (!window.confirm(`Change ${u.email}'s role to "${newRole}"?`))
            return;
        updateUser(u.uid, { role: newRole });
    }
    function handleBanToggle(u) {
        const action = u.isBlacklisted ? "unban" : "ban";
        if (!window.confirm(`Are you sure you want to ${action} ${u.email}?`))
            return;
        updateUser(u.uid, { isBlacklisted: !u.isBlacklisted });
    }
    async function openDrawer(u) {
        setSelectedUser(u);
        setDrawerStats(null);
        setDrawerLoading(true);
        try {
            const [listingsSnap, reportsSnap] = await Promise.all([
                getDocs(query(collection(db, "listings"), where("userId", "==", u.uid), where("isArchived", "==", false))),
                getDocs(query(collection(db, "reports"), where("listingUserId", "==", u.uid))),
            ]);
            setDrawerStats({
                listingCount: listingsSnap.size,
                reportCount: reportsSnap.size,
            });
        }
        catch (err) {
            console.error("[UsersPage] drawer stats failed:", err);
            setDrawerStats({ listingCount: 0, reportCount: 0 });
        }
        finally {
            setDrawerLoading(false);
        }
    }
    const filtered = users.filter(u => {
        const matchesSearch = !search.trim() ||
            u.email?.toLowerCase().includes(search.toLowerCase()) ||
            u.displayName?.toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter === "all" ? true :
            roleFilter === "banned" ? u.isBlacklisted :
                u.role === roleFilter;
        return matchesSearch && matchesRole;
    });
    const ROLE_OPTIONS = ["user", "editor", "admin"];
    return (_jsxs("div", { className: "p-6", children: [toast && (_jsx(Toast, { message: toast.message, type: toast.type, onDone: () => setToast(null) })), _jsxs("div", { className: "mb-5", children: [_jsx("h1", { className: "text-xl font-bold text-slate-800 dark:text-slate-200", children: "Users" }), _jsxs("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-0.5", children: [users.length, " total accounts"] })] }), _jsxs("div", { className: "flex flex-wrap gap-3 mb-5", children: [_jsx("input", { value: search, onChange: e => setSearch(e.target.value), placeholder: "Search by name or email\u2026", className: "w-full max-w-md bg-white dark:bg-slate-800 border border-gray-200\n                          dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm min-h-[44px]\n                          focus:outline-none focus:ring-2 focus:ring-blue-500\n                          text-slate-800 dark:text-slate-200" }), _jsxs("select", { value: roleFilter, onChange: e => setRoleFilter(e.target.value), className: "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700\n                     rounded-xl px-3 py-2.5 text-sm min-h-[44px] text-slate-700\n                     dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "all", children: "All Users" }), _jsx("option", { value: "admin", children: "Admin" }), _jsx("option", { value: "editor", children: "Editor" }), _jsx("option", { value: "user", children: "User" }), _jsx("option", { value: "banned", children: "Banned" })] })] }), loading ? (_jsx("div", { className: "space-y-2", children: [...Array(5)].map((_, i) => (_jsx("div", { className: "h-16 bg-white dark:bg-slate-800 rounded-2xl\n                                    animate-pulse border border-gray-100 dark:border-slate-700" }, i))) })) : (_jsx("div", { className: "bg-white dark:bg-slate-800 rounded-2xl border border-gray-100\n                        dark:border-slate-700 overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-gray-100 dark:border-slate-700 text-left", children: [_jsx("th", { className: "px-4 py-3 text-xs font-semibold text-slate-400\n                                 uppercase tracking-wide", children: "User" }), _jsx("th", { className: "px-4 py-3 text-xs font-semibold text-slate-400\n                                 uppercase tracking-wide", children: "Role" }), _jsx("th", { className: "px-4 py-3 text-xs font-semibold text-slate-400\n                                 uppercase tracking-wide", children: "Status" }), _jsx("th", { className: "px-4 py-3 text-xs font-semibold text-slate-400\n                                 uppercase tracking-wide", children: "Joined" }), _jsx("th", { className: "px-4 py-3 text-xs font-semibold text-slate-400\n                                 uppercase tracking-wide", children: "Actions" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-50 dark:divide-slate-700/50", children: filtered.map(u => (_jsxs("tr", { onClick: () => openDrawer(u), className: "hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer", children: [_jsxs("td", { className: "px-4 py-3", children: [_jsx("p", { className: "font-medium text-slate-800 dark:text-slate-200", children: u.displayName || "—" }), _jsx("p", { className: "text-xs text-slate-400", children: u.email })] }), _jsx("td", { className: "px-4 py-3", children: isAdmin && u.uid !== adminUser?.uid ? (_jsx("select", { value: u.role || "user", onChange: e => handleRoleChange(u, e.target.value), className: "bg-slate-50 dark:bg-slate-700 border border-gray-200\n                                     dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs\n                                     text-slate-700 dark:text-slate-300 min-h-[36px]", children: ROLE_OPTIONS.map(r => (_jsx("option", { value: r, children: r }, r))) })) : (_jsx("span", { className: `text-xs font-medium capitalize px-2 py-1 rounded-full
                          ${u.role === "admin"
                                                    ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                                    : u.role === "editor"
                                                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                                                        : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`, children: u.role || "user" })) }), _jsx("td", { className: "px-4 py-3", children: u.isBlacklisted
                                                ? _jsx("span", { className: "text-xs text-red-500 font-medium", children: "Banned" })
                                                : _jsx("span", { className: "text-xs text-green-500 font-medium", children: "Active" }) }), _jsx("td", { className: "px-4 py-3 text-xs text-slate-400", children: u.createdAt
                                                ? new Date(u.createdAt).toLocaleDateString("en-MY", {
                                                    month: "short", year: "numeric", day: "numeric"
                                                })
                                                : "—" }), _jsx("td", { className: "px-4 py-3", children: u.uid !== adminUser?.uid && (_jsx("button", { onClick: () => handleBanToggle(u), className: `flex items-center gap-1.5 text-xs rounded-xl px-3 py-1.5
                                      border min-h-[36px] transition-colors
                                      ${u.isBlacklisted
                                                    ? "border-green-200 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                                    : "border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"}`, children: u.isBlacklisted
                                                    ? _jsxs(_Fragment, { children: [_jsx(CheckCircle, { className: "w-3 h-3" }), " Unban"] })
                                                    : _jsxs(_Fragment, { children: [_jsx(Ban, { className: "w-3 h-3" }), " Ban"] }) })) })] }, u.uid))) })] }) }) })), selectedUser && (_jsxs("div", { className: "fixed inset-0 z-50 flex justify-end", children: [_jsx("div", { className: "absolute inset-0 bg-black/30 dark:bg-black/50", onClick: () => setSelectedUser(null) }), _jsxs("div", { className: "relative w-full max-w-sm bg-white dark:bg-slate-800\n                          h-full overflow-y-auto shadow-2xl flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b\n                            border-gray-100 dark:border-slate-700", children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [_jsx("div", { className: "w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40\n                                flex items-center justify-center flex-shrink-0 text-blue-600\n                                dark:text-blue-400 font-bold text-sm", children: (selectedUser.displayName ?? selectedUser.email ?? "?")[0].toUpperCase() }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-slate-800 dark:text-slate-200 truncate", children: selectedUser.displayName ?? "—" }), _jsx("p", { className: "text-xs text-slate-400 truncate", children: selectedUser.email })] })] }), _jsx("button", { onClick: () => setSelectedUser(null), className: "flex-shrink-0 p-2 text-slate-400 hover:text-slate-700\n                           dark:hover:text-slate-200 rounded-lg transition-colors", children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsxs("div", { className: "flex-1 px-5 py-5 space-y-5", children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("span", { className: `text-xs font-medium capitalize px-2.5 py-1 rounded-full ${selectedUser.role === "admin"
                                                    ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                                    : selectedUser.role === "editor"
                                                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                                                        : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`, children: selectedUser.role ?? "user" }), selectedUser.isBlacklisted && (_jsx("span", { className: "text-xs font-medium px-2.5 py-1 rounded-full\n                                   bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400", children: "Banned" })), selectedUser.verificationStatus === "approved" && (_jsx("span", { className: "text-xs font-medium px-2.5 py-1 rounded-full\n                                   bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400", children: "XMUM Verified" })), selectedUser.verificationStatus === "pending" && (_jsx("span", { className: "text-xs font-medium px-2.5 py-1 rounded-full\n                                   bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400", children: "Verification Pending" }))] }), _jsxs("div", { className: "space-y-2 text-sm", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500 dark:text-slate-400", children: "UID" }), _jsx("span", { className: "font-mono text-xs text-slate-600 dark:text-slate-300\n                                   truncate max-w-[180px]", children: selectedUser.uid })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500 dark:text-slate-400", children: "Joined" }), _jsx("span", { className: "text-slate-700 dark:text-slate-300", children: selectedUser.createdAt
                                                            ? new Date(selectedUser.createdAt).toLocaleDateString("en-MY", {
                                                                day: "numeric", month: "short", year: "numeric"
                                                            })
                                                            : "—" })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500 dark:text-slate-400", children: "Email verified" }), _jsx("span", { className: selectedUser.emailVerified
                                                            ? "text-green-600 dark:text-green-400"
                                                            : "text-red-500", children: selectedUser.emailVerified ? "Yes" : "No" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center", children: [drawerLoading ? (_jsx("div", { className: "h-6 bg-slate-200 dark:bg-slate-600 rounded animate-pulse mx-auto w-8 mb-1" })) : (_jsx("p", { className: "text-xl font-bold text-slate-800 dark:text-slate-200", children: drawerStats?.listingCount ?? "—" })), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-0.5", children: "Active Listings" })] }), _jsxs("div", { className: "bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center", children: [drawerLoading ? (_jsx("div", { className: "h-6 bg-slate-200 dark:bg-slate-600 rounded animate-pulse mx-auto w-8 mb-1" })) : (_jsx("p", { className: `text-xl font-bold ${(drawerStats?.reportCount ?? 0) > 0
                                                            ? "text-red-500"
                                                            : "text-slate-800 dark:text-slate-200"}`, children: drawerStats?.reportCount ?? "—" })), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-0.5", children: "Reports Against" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide", children: "Actions" }), selectedUser.uid !== adminUser?.uid && (_jsx("button", { onClick: () => {
                                                    handleBanToggle(selectedUser);
                                                    setSelectedUser(null);
                                                }, className: `w-full flex items-center justify-center gap-2 text-sm font-medium
                                rounded-xl min-h-[44px] border transition-colors
                                ${selectedUser.isBlacklisted
                                                    ? "border-green-200 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                                    : "border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"}`, children: selectedUser.isBlacklisted ? "Unban User" : "Ban User" }))] })] })] })] }))] }));
}
