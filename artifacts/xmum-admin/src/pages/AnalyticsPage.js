import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer, } from "recharts";
import { Users, List, Flag, Star, Store, CheckCircle, Loader2, } from "lucide-react";
// ── Constants ────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
    "buy-sell": "#003366",
    "lost-found": "#0D9488",
    "jobs": "#7C3AED",
    "assistance": "#EA580C",
    "rental": "#D97706",
};
const TYPE_LABELS = {
    "buy-sell": "Buy & Sell",
    "lost-found": "Lost & Found",
    "jobs": "Jobs",
    "assistance": "Assistance",
    "rental": "Rental",
};
const TOOLTIP_STYLE = {
    fontSize: 12, borderRadius: 12, border: "none",
    boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
};
// ── Helpers ──────────────────────────────────────────────────────────────────
function dateKey(ms, range) {
    if (range === 90) {
        const d = new Date(ms);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        return weekStart.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
    }
    return new Date(ms).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}
function buildDayRange(range) {
    const keys = [];
    const seen = new Set();
    for (let i = range - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const ms = d.getTime();
        const k = dateKey(ms, range);
        if (!seen.has(k)) {
            seen.add(k);
            keys.push(k);
        }
    }
    return keys;
}
// ── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }) {
    return (_jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-2xl p-5 border\n                    border-gray-100 dark:border-slate-700", children: [_jsx("div", { className: `w-10 h-10 ${color} rounded-xl flex items-center
                       justify-center mb-3`, children: _jsx(Icon, { className: "w-5 h-5 text-white" }) }), _jsx("p", { className: "text-2xl font-bold text-slate-800 dark:text-slate-200", children: value }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-0.5", children: label }), sub && (_jsx("p", { className: "text-xs text-slate-400 dark:text-slate-500 mt-0.5", children: sub }))] }));
}
function ChartCard({ title, children }) {
    return (_jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-2xl p-6 border\n                    border-gray-100 dark:border-slate-700", children: [_jsx("h2", { className: "text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4", children: title }), children] }));
}
// ── Main Component ───────────────────────────────────────────────────────────
export default function AnalyticsPage() {
    const [range, setRange] = useState(30);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [listingsPerDay, setListingsPerDay] = useState([]);
    const [signupsPerDay, setSignupsPerDay] = useState([]);
    const [typeDistribution, setTypeDistribution] = useState([]);
    const [viewsPerDay, setViewsPerDay] = useState([]);
    const load = useCallback(async (selectedRange) => {
        setLoading(true);
        try {
            const since = Date.now() - selectedRange * 24 * 60 * 60 * 1000;
            let resolvedReports = 0;
            const [listingsSnap, usersSnap, pendingReportsSnap, shopReviewsSnap, shopsSnap, recentUsersSnap,] = await Promise.all([
                getDocs(query(collection(db, "listings"), where("createdAt", ">=", since))),
                getDocs(collection(db, "users")),
                getDocs(query(collection(db, "reports"), where("status", "==", "pending"))),
                getDocs(collection(db, "shopReviews")),
                getDocs(collection(db, "shops")),
                getDocs(query(collection(db, "users"), where("createdAt", ">=", since))),
            ]);
            try {
                const resolvedSnap = await getDocs(query(collection(db, "reports"), where("status", "in", ["resolved", "dismissed", "actioned"])));
                resolvedReports = resolvedSnap.size;
            }
            catch (err) {
                console.warn("[AnalyticsPage] resolved reports query failed (index may be missing):", err);
            }
            setStats({
                totalUsers: usersSnap.size,
                totalListings: listingsSnap.size,
                pendingReports: pendingReportsSnap.size,
                resolvedReports,
                totalShopReviews: shopReviewsSnap.size,
                totalShops: shopsSnap.size,
            });
            const days = buildDayRange(selectedRange);
            const countMap = {};
            const viewMap = {};
            const signupMap = {};
            const typeMap = {};
            days.forEach((d) => { countMap[d] = 0; viewMap[d] = 0; signupMap[d] = 0; });
            listingsSnap.docs.forEach((d) => {
                const data = d.data();
                const k = dateKey(data.createdAt, selectedRange);
                if (k in countMap)
                    countMap[k]++;
                if (k in viewMap)
                    viewMap[k] += (data.viewCount ?? 0);
                const type = (data.type ?? "other");
                typeMap[type] = (typeMap[type] ?? 0) + 1;
            });
            recentUsersSnap.docs.forEach((d) => {
                const data = d.data();
                const k = dateKey(data.createdAt, selectedRange);
                if (k in signupMap)
                    signupMap[k]++;
            });
            setListingsPerDay(days.map((date) => ({ date, count: countMap[date] ?? 0 })));
            setViewsPerDay(days.map((date) => ({ date, views: viewMap[date] ?? 0 })));
            setSignupsPerDay(days.map((date) => ({ date, signups: signupMap[date] ?? 0 })));
            setTypeDistribution(Object.entries(typeMap).map(([name, value]) => ({ name, value })));
        }
        catch (err) {
            console.error("[AnalyticsPage] load failed:", err);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        load(range);
    }, [range, load]);
    const resolutionRate = stats
        ? stats.resolvedReports + stats.pendingReports > 0
            ? Math.round((stats.resolvedReports / (stats.resolvedReports + stats.pendingReports)) * 100)
            : 0
        : 0;
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between gap-4 flex-wrap", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-slate-800 dark:text-slate-200", children: "Analytics" }), _jsxs("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-0.5", children: ["Platform overview \u2014 last ", range, " days"] })] }), _jsx("div", { className: "flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1", children: [7, 30, 90].map((r) => (_jsxs("button", { onClick: () => setRange(r), className: `px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[36px]
                ${range === r
                                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`, children: [r, "d"] }, r))) })] }), loading ? (_jsx("div", { className: "flex items-center justify-center h-48", children: _jsx(Loader2, { className: "w-7 h-7 animate-spin text-slate-400" }) })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4", children: [_jsx(StatCard, { icon: Users, label: "Total Users", value: stats?.totalUsers ?? 0, color: "bg-blue-500" }), _jsx(StatCard, { icon: List, label: `Listings (${range}d)`, value: stats?.totalListings ?? 0, color: "bg-green-500" }), _jsx(StatCard, { icon: Store, label: "Total Shops", value: stats?.totalShops ?? 0, color: "bg-teal-500" }), _jsx(StatCard, { icon: Star, label: "Shop Reviews", value: stats?.totalShopReviews ?? 0, color: "bg-amber-500" }), _jsx(StatCard, { icon: Flag, label: "Pending Reports", value: stats?.pendingReports ?? 0, color: "bg-red-500" }), _jsx(StatCard, { icon: CheckCircle, label: "Report Resolution", value: `${resolutionRate}%`, sub: `${stats?.resolvedReports ?? 0} resolved`, color: "bg-purple-500" })] }), _jsx(ChartCard, { title: `Listings Posted (Last ${range} Days)`, children: listingsPerDay.every((d) => d.count === 0) ? (_jsx("p", { className: "text-sm text-slate-400 text-center py-8", children: "No listings in this period." })) : (_jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(BarChart, { data: listingsPerDay, margin: { top: 0, right: 4, left: -20, bottom: 0 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#f0f0f0" }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 10, fill: "#94a3b8" }, interval: range === 7 ? 0 : range === 30 ? 4 : 1, tickLine: false, axisLine: false }), _jsx(YAxis, { allowDecimals: false, tick: { fontSize: 10, fill: "#94a3b8" }, tickLine: false, axisLine: false }), _jsx(Tooltip, { contentStyle: TOOLTIP_STYLE }), _jsx(Bar, { dataKey: "count", name: "Listings", fill: "#003366", radius: [4, 4, 0, 0] })] }) })) }), _jsx(ChartCard, { title: `New User Sign-ups (Last ${range} Days)`, children: signupsPerDay.every((d) => d.signups === 0) ? (_jsx("p", { className: "text-sm text-slate-400 text-center py-8", children: "No sign-ups in this period." })) : (_jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(BarChart, { data: signupsPerDay, margin: { top: 0, right: 4, left: -20, bottom: 0 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#f0f0f0" }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 10, fill: "#94a3b8" }, interval: range === 7 ? 0 : range === 30 ? 4 : 1, tickLine: false, axisLine: false }), _jsx(YAxis, { allowDecimals: false, tick: { fontSize: 10, fill: "#94a3b8" }, tickLine: false, axisLine: false }), _jsx(Tooltip, { contentStyle: TOOLTIP_STYLE }), _jsx(Bar, { dataKey: "signups", name: "Sign-ups", fill: "#0D9488", radius: [4, 4, 0, 0] })] }) })) }), _jsx(ChartCard, { title: "Listings by Type", children: typeDistribution.length === 0 ? (_jsx("p", { className: "text-sm text-slate-400 text-center py-8", children: "No data yet." })) : (_jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: typeDistribution, dataKey: "value", nameKey: "name", cx: "50%", cy: "50%", outerRadius: 80, label: ({ name, percent }) => name
                                            ? `${TYPE_LABELS[name] ?? name} ${((percent ?? 0) * 100).toFixed(0)}%`
                                            : "", labelLine: false, children: typeDistribution.map((entry, i) => (_jsx(Cell, { fill: TYPE_COLORS[entry.name] ?? `hsl(${i * 60},60%,50%)` }, i))) }), _jsx(Tooltip, { formatter: (v, n) => [v, TYPE_LABELS[n] ?? n], contentStyle: TOOLTIP_STYLE }), _jsx(Legend, { formatter: (v) => TYPE_LABELS[v] ?? v, iconType: "circle", iconSize: 8, wrapperStyle: { fontSize: 12 } })] }) })) }), _jsx(ChartCard, { title: `Total Listing Views (Last ${range} Days)`, children: viewsPerDay.every((d) => d.views === 0) ? (_jsx("p", { className: "text-sm text-slate-400 text-center py-8", children: "No view data in this period." })) : (_jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(LineChart, { data: viewsPerDay, margin: { top: 0, right: 4, left: -20, bottom: 0 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#f0f0f0" }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 10, fill: "#94a3b8" }, interval: range === 7 ? 0 : range === 30 ? 4 : 1, tickLine: false, axisLine: false }), _jsx(YAxis, { allowDecimals: false, tick: { fontSize: 10, fill: "#94a3b8" }, tickLine: false, axisLine: false }), _jsx(Tooltip, { contentStyle: TOOLTIP_STYLE }), _jsx(Line, { type: "monotone", dataKey: "views", name: "Views", stroke: "#0055CC", strokeWidth: 2, dot: false, activeDot: { r: 4 } })] }) })) })] }))] }));
}
