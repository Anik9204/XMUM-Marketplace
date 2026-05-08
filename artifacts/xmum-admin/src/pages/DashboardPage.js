import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Users, Flag, Megaphone, ShoppingBag, TrendingUp } from "lucide-react";
function StatCard({ icon: Icon, label, value, color }) {
    return (_jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-2xl p-5 border\n                    border-gray-100 dark:border-slate-700", children: [_jsx("div", { className: `w-10 h-10 ${color} rounded-xl flex items-center
                       justify-center mb-3`, children: _jsx(Icon, { className: "w-5 h-5 text-white" }) }), _jsx("p", { className: "text-2xl font-bold text-slate-800 dark:text-slate-200", children: value }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-0.5", children: label })] }));
}
export default function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        async function load() {
            try {
                const [usersSnap, listingsSnap, reportsSnap, adsSnap] = await Promise.all([
                    getDocs(collection(db, "users")),
                    getDocs(query(collection(db, "listings"), where("isArchived", "==", false))),
                    getDocs(query(collection(db, "reports"), where("status", "==", "pending"))),
                    getDocs(query(collection(db, "ads"), where("isActive", "==", true))),
                ]);
                const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                const recentSignups = usersSnap.docs.filter(d => (d.data().createdAt ?? 0) > sevenDaysAgo).length;
                setStats({
                    totalUsers: usersSnap.size,
                    totalListings: listingsSnap.size,
                    pendingReports: reportsSnap.size,
                    activeAds: adsSnap.size,
                    recentSignups,
                });
            }
            catch (e) {
                console.error(e);
            }
            finally {
                setLoading(false);
            }
        }
        load();
    }, []);
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h1", { className: "text-xl font-bold text-slate-800 dark:text-slate-200", children: "Dashboard" }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-0.5", children: "Platform overview" })] }), loading ? (_jsx("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4", children: [...Array(5)].map((_, i) => (_jsx("div", { className: "bg-white dark:bg-slate-800 rounded-2xl p-5 h-28\n                                    animate-pulse border border-gray-100 dark:border-slate-700" }, i))) })) : stats ? (_jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsx(StatCard, { icon: Users, label: "Total Users", value: stats.totalUsers, color: "bg-blue-500" }), _jsx(StatCard, { icon: ShoppingBag, label: "Active Listings", value: stats.totalListings, color: "bg-green-500" }), _jsx(StatCard, { icon: Flag, label: "Pending Reports", value: stats.pendingReports, color: "bg-red-500" }), _jsx(StatCard, { icon: Megaphone, label: "Active Ads", value: stats.activeAds, color: "bg-amber-500" }), _jsx(StatCard, { icon: TrendingUp, label: "New Users (7d)", value: stats.recentSignups, color: "bg-purple-500" })] })) : null] }));
}
