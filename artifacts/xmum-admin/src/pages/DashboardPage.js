import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from "firebase/firestore";
import { Link } from "wouter";
import { db } from "../lib/firebase";
import { Users, Flag, Megaphone, ShoppingBag, TrendingUp, GraduationCap, Store, Newspaper, Activity, AlertTriangle, ClipboardList, } from "lucide-react";
const defaultStats = {
    totalUsers: 0, totalListings: 0, pendingReports: 0,
    activeAds: 0, recentSignups: 0, pendingVerifications: 0,
    pendingShopAds: 0, totalShops: 0, suspendedShops: 0, pendingShopApprovals: 0,
};
function StatCard({ icon: Icon, label, value, color, href }) {
    const inner = (_jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-2xl p-5 border\n                    border-gray-100 dark:border-slate-700 hover:border-blue-200\n                    dark:hover:border-blue-700 transition-colors cursor-pointer", children: [_jsx("div", { className: `w-10 h-10 ${color} rounded-xl flex items-center
                       justify-center mb-3`, children: _jsx(Icon, { className: "w-5 h-5 text-white" }) }), _jsx("p", { className: "text-2xl font-bold text-slate-800 dark:text-slate-200", children: value }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-0.5", children: label })] }));
    if (href)
        return _jsx(Link, { href: href, children: inner });
    return inner;
}
export default function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activity, setActivity] = useState([]);
    const [activityLoading, setActivityLoading] = useState(true);
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
            setStats(p => ({ ...(p ?? defaultStats), pendingReports: snap.size }));
            setLoading(false);
        }, err => {
            console.error("[Dashboard] reports snapshot:", err);
            setLoading(false);
        }));
        unsubs.push(onSnapshot(query(collection(db, "users"), where("verificationStatus", "==", "pending")), (snap) => setStats(p => ({ ...(p ?? defaultStats), pendingVerifications: snap.size })), err => console.error("[Dashboard] verifications snapshot:", err)));
        unsubs.push(onSnapshot(query(collection(db, "shopAds"), where("status", "==", "pending")), (snap) => setStats(p => ({ ...(p ?? defaultStats), pendingShopAds: snap.size })), err => console.error("[Dashboard] shopAds snapshot:", err)));
        unsubs.push(onSnapshot(collection(db, "shops"), (snap) => setStats(p => ({ ...(p ?? defaultStats), totalShops: snap.size })), err => console.error("[Dashboard] shops snapshot:", err)));
        unsubs.push(onSnapshot(query(collection(db, "shops"), where("isSuspended", "==", true)), (snap) => setStats(p => ({ ...(p ?? defaultStats), suspendedShops: snap.size })), err => console.error("[Dashboard] suspendedShops snapshot:", err)));
        unsubs.push(onSnapshot(query(collection(db, "shops"), where("approvalStatus", "==", "pending")), (snap) => setStats(p => ({ ...(p ?? defaultStats), pendingShopApprovals: snap.size })), err => console.error("[Dashboard] pendingShopApprovals snapshot:", err)));
        return () => unsubs.forEach(u => u());
    }, []);
    useEffect(() => {
        let mounted = true;
        async function loadActivity() {
            setActivityLoading(true);
            try {
                const [reportsSnap, signupsSnap, shopAdsSnap] = await Promise.all([
                    getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(5))),
                    getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5))),
                    getDocs(query(collection(db, "shopAds"), orderBy("submittedAt", "desc"), limit(5))),
                ]);
                const items = [];
                reportsSnap.docs.forEach(d => {
                    const data = d.data();
                    items.push({
                        id: d.id,
                        type: "report",
                        label: `Report: "${data.listingTitle ?? "listing"}"`,
                        sub: `by ${data.reportedByEmail ?? "unknown"} · ${data.status ?? "pending"}`,
                        time: data.createdAt ?? 0,
                        href: "/reports",
                    });
                });
                signupsSnap.docs.forEach(d => {
                    const data = d.data();
                    items.push({
                        id: d.id,
                        type: "signup",
                        label: `New user: ${data.displayName ?? data.email ?? "unknown"}`,
                        sub: data.email ?? "",
                        time: data.createdAt ?? 0,
                        href: "/users",
                    });
                });
                shopAdsSnap.docs.forEach(d => {
                    const data = d.data();
                    items.push({
                        id: d.id,
                        type: "shop_ad",
                        label: `Shop ad: "${data.shopName ?? "shop"}"`,
                        sub: `status: ${data.status ?? "pending"}`,
                        time: data.submittedAt ?? 0,
                        href: "/shop-ads",
                    });
                });
                items.sort((a, b) => b.time - a.time);
                if (mounted)
                    setActivity(items.slice(0, 10));
            }
            catch (err) {
                console.error("[Dashboard] activity load failed:", err);
            }
            finally {
                if (mounted)
                    setActivityLoading(false);
            }
        }
        loadActivity();
        return () => { mounted = false; };
    }, []);
    return (_jsxs("div", { className: "p-6", children: [_jsx("div", { className: "flex items-center justify-between mb-6", children: _jsxs("div", { children: [_jsxs("h1", { className: "text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center", children: ["Dashboard", _jsxs("span", { className: "inline-flex items-center gap-1 text-[10px] font-semibold\n                             text-green-600 dark:text-green-400 bg-green-50\n                             dark:bg-green-900/30 px-2 py-0.5 rounded-full ml-2", children: [_jsx("span", { className: "w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" }), "Live"] })] }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-0.5", children: "Platform overview" })] }) }), loading ? (_jsx("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8", children: [...Array(8)].map((_, i) => (_jsx("div", { className: "bg-white dark:bg-slate-800 rounded-2xl p-5 h-28\n                                    animate-pulse border border-gray-100 dark:border-slate-700" }, i))) })) : stats ? (_jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8", children: [_jsx(StatCard, { icon: Users, label: "Total Users", value: stats.totalUsers, color: "bg-blue-500", href: "/users" }), _jsx(StatCard, { icon: ShoppingBag, label: "Active Listings", value: stats.totalListings, color: "bg-green-500", href: "/listings" }), _jsx(StatCard, { icon: Flag, label: "Pending Reports", value: stats.pendingReports, color: "bg-red-500", href: "/reports" }), _jsx(StatCard, { icon: GraduationCap, label: "Pending Verifications", value: stats.pendingVerifications, color: "bg-indigo-500", href: "/verifications" }), _jsx(StatCard, { icon: Newspaper, label: "Pending Shop Ads", value: stats.pendingShopAds, color: "bg-amber-500", href: "/shop-ads" }), _jsx(StatCard, { icon: Store, label: "Total Shops", value: stats.totalShops, color: "bg-teal-500", href: "/shops" }), _jsx(StatCard, { icon: AlertTriangle, label: "Suspended Shops", value: stats.suspendedShops, color: "bg-orange-500", href: "/shops" }), _jsx(StatCard, { icon: ClipboardList, label: "Pending Shop Approvals", value: stats.pendingShopApprovals, color: "bg-amber-600", href: "/shop-approvals" }), _jsx(StatCard, { icon: Megaphone, label: "Active Platform Ads", value: stats.activeAds, color: "bg-purple-500", href: "/ads" }), _jsx(StatCard, { icon: TrendingUp, label: "New Users (7d)", value: stats.recentSignups, color: "bg-pink-500" })] })) : null, _jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-2xl border border-gray-100\n                      dark:border-slate-700 overflow-hidden", children: [_jsxs("div", { className: "px-5 py-4 border-b border-gray-100 dark:border-slate-700\n                        flex items-center gap-2", children: [_jsx(Activity, { className: "w-4 h-4 text-slate-400" }), _jsx("h2", { className: "text-sm font-semibold text-slate-700 dark:text-slate-300", children: "Recent Activity" })] }), activityLoading ? (_jsx("div", { className: "space-y-px", children: [...Array(5)].map((_, i) => (_jsx("div", { className: "h-14 bg-slate-50 dark:bg-slate-800/50 animate-pulse mx-4 my-2 rounded-xl" }, i))) })) : activity.length === 0 ? (_jsx("p", { className: "text-sm text-slate-400 text-center py-10", children: "No recent activity." })) : (_jsx("div", { className: "divide-y divide-gray-50 dark:divide-slate-700/50", children: activity.map((item) => (_jsx(Link, { href: item.href, children: _jsxs("div", { className: "flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50\n                                dark:hover:bg-slate-700/30 transition-colors cursor-pointer", children: [_jsx("div", { className: `w-2 h-2 rounded-full flex-shrink-0 ${item.type === "report" ? "bg-red-400" :
                                            item.type === "signup" ? "bg-green-400" :
                                                "bg-amber-400"}` }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-slate-700 dark:text-slate-300 truncate", children: item.label }), _jsx("p", { className: "text-xs text-slate-400 truncate", children: item.sub })] }), _jsx("span", { className: "text-[11px] text-slate-400 flex-shrink-0", children: new Date(item.time).toLocaleDateString("en-MY", {
                                            day: "numeric", month: "short",
                                        }) })] }) }, item.id + item.time))) }))] })] }));
}
