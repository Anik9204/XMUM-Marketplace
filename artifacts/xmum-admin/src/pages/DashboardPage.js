import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Users, Flag, Megaphone, ShoppingBag, TrendingUp } from "lucide-react";
const defaultStats = {
    totalUsers: 0,
    totalListings: 0,
    pendingReports: 0,
    activeAds: 0,
    recentSignups: 0,
};
function StatCard({ icon: Icon, label, value, color }) {
    return (_jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-2xl p-5 border\n                    border-gray-100 dark:border-slate-700", children: [_jsx("div", { className: `w-10 h-10 ${color} rounded-xl flex items-center
                       justify-center mb-3`, children: _jsx(Icon, { className: "w-5 h-5 text-white" }) }), _jsx("p", { className: "text-2xl font-bold text-slate-800 dark:text-slate-200", children: value }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-0.5", children: label })] }));
}
export default function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pendingReports, setPendingReports] = useState(0);
    useEffect(() => {
        const unsubs = [];
        unsubs.push(onSnapshot(collection(db, "users"), (snap) => {
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const recentSignups = snap.docs.filter(d => (d.data().createdAt ?? 0) > sevenDaysAgo).length;
            setStats(p => ({
                ...(p ?? defaultStats),
                totalUsers: snap.size,
                recentSignups,
            }));
        }, err => console.error("[Dashboard] users snapshot:", err)));
        unsubs.push(onSnapshot(query(collection(db, "listings"), where("isArchived", "==", false)), (snap) => setStats(p => ({ ...(p ?? defaultStats), totalListings: snap.size })), err => console.error("[Dashboard] listings snapshot:", err)));
        unsubs.push(onSnapshot(query(collection(db, "ads"), where("isActive", "==", true)), (snap) => setStats(p => ({ ...(p ?? defaultStats), activeAds: snap.size })), err => console.error("[Dashboard] ads snapshot:", err)));
        unsubs.push(onSnapshot(query(collection(db, "reports"), where("status", "==", "pending")), (snap) => {
            const count = snap.size;
            setPendingReports(count);
            setStats(p => ({ ...(p ?? defaultStats), pendingReports: count }));
            setLoading(false);
        }, err => {
            console.error("[Dashboard] reports snapshot:", err);
            setLoading(false);
        }));
        return () => unsubs.forEach(u => u());
    }, []);
    return (_jsxs("div", { className: "p-6", children: [_jsx("div", { className: "flex items-center justify-between mb-6", children: _jsxs("div", { children: [_jsxs("h1", { className: "text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center", children: ["Dashboard", _jsxs("span", { className: "inline-flex items-center gap-1 text-[10px] font-semibold\n                             text-green-600 dark:text-green-400 bg-green-50\n                             dark:bg-green-900/30 px-2 py-0.5 rounded-full ml-2", children: [_jsx("span", { className: "w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" }), "Live"] })] }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-0.5", children: "Platform overview" })] }) }), loading ? (_jsx("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4", children: [...Array(5)].map((_, i) => (_jsx("div", { className: "bg-white dark:bg-slate-800 rounded-2xl p-5 h-28\n                                    animate-pulse border border-gray-100 dark:border-slate-700" }, i))) })) : stats ? (_jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsx(StatCard, { icon: Users, label: "Total Users", value: stats.totalUsers, color: "bg-blue-500" }), _jsx(StatCard, { icon: ShoppingBag, label: "Active Listings", value: stats.totalListings, color: "bg-green-500" }), _jsx(StatCard, { icon: Flag, label: "Pending Reports", value: pendingReports, color: "bg-red-500" }), _jsx(StatCard, { icon: Megaphone, label: "Active Ads", value: stats.activeAds, color: "bg-amber-500" }), _jsx(StatCard, { icon: TrendingUp, label: "New Users (7d)", value: stats.recentSignups, color: "bg-purple-500" })] })) : null] }));
}
