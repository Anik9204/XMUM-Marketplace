import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ExternalLink, Trash2, CheckCircle, XCircle } from "lucide-react";
const STATUS_COLORS = {
    pending: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    reviewed: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    dismissed: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
    actioned: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
};
const MAIN_APP_URL = "https://your-main-app.vercel.app";
export default function ReportsPage() {
    const { adminUser, isAdmin } = useAuth();
    const [reports, setReports] = useState([]);
    const [filter, setFilter] = useState("pending");
    const [loading, setLoading] = useState(true);
    async function load() {
        setLoading(true);
        try {
            const snap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc")));
            setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            console.error("[ReportsPage] load failed:", e);
            alert("Failed to load reports. Check the console for details.");
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); }, []);
    async function updateStatus(id, status) {
        await Promise.race([
            updateDoc(doc(db, "reports", id), {
                status,
                reviewedBy: adminUser?.uid,
                reviewedAt: Date.now(),
            }),
            new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 6000)),
        ]);
        setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    }
    async function deleteReport(id) {
        if (!isAdmin)
            return;
        await deleteDoc(doc(db, "reports", id));
        setReports(prev => prev.filter(r => r.id !== id));
    }
    const filtered = filter === "all" ? reports : reports.filter(r => r.status === filter);
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "mb-5", children: [_jsx("h1", { className: "text-xl font-bold text-slate-800 dark:text-slate-200", children: "Reports" }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-0.5", children: "User-submitted listing reports" })] }), _jsx("div", { className: "flex gap-2 mb-5 flex-wrap", children: ["all", "pending", "reviewed", "actioned", "dismissed"].map(s => (_jsx("button", { onClick: () => setFilter(s), className: `px-4 py-2 rounded-xl text-sm font-medium min-h-[40px]
                              transition-colors capitalize
                              ${filter === s
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700"}`, children: s }, s))) }), loading ? (_jsx("div", { className: "space-y-3", children: [...Array(4)].map((_, i) => (_jsx("div", { className: "bg-white dark:bg-slate-800 rounded-2xl h-24\n                                    animate-pulse border border-gray-100 dark:border-slate-700" }, i))) })) : filtered.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center py-20 text-center", children: [_jsx("span", { className: "text-5xl mb-3", children: "\uD83C\uDF89" }), _jsxs("p", { className: "font-semibold text-slate-700 dark:text-slate-300", children: ["No ", filter !== "all" ? filter : "", " reports"] })] })) : (_jsx("div", { className: "space-y-3", children: filtered.map(report => (_jsx("div", { className: "bg-white dark:bg-slate-800 rounded-2xl p-5 border\n                            border-gray-100 dark:border-slate-700", children: _jsxs("div", { className: "flex items-start justify-between gap-4 flex-wrap", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap mb-1", children: [_jsx("span", { className: `text-[10px] font-semibold uppercase tracking-wide
                                      px-2 py-0.5 rounded-full ${STATUS_COLORS[report.status]}`, children: report.status }), _jsx("span", { className: "text-[10px] text-slate-400 capitalize", children: report.category.replace("_", " ") })] }), _jsx("p", { className: "text-sm font-semibold text-slate-800 dark:text-slate-200 truncate", children: report.listingTitle }), _jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-0.5", children: ["Reported by: ", report.reportedByEmail] }), _jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: ["Seller: ", report.listingUserEmail] }), _jsxs("p", { className: "text-sm text-slate-700 dark:text-slate-300 mt-2\n                                bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2", children: ["\"", report.reason, "\""] }), _jsx("p", { className: "text-[10px] text-slate-400 mt-1", children: new Date(report.createdAt).toLocaleString() })] }), _jsxs("div", { className: "flex flex-col gap-2 flex-shrink-0", children: [_jsxs("a", { href: `${MAIN_APP_URL}/listing/${report.listingId}`, target: "_blank", rel: "noopener noreferrer", className: "flex items-center gap-1.5 text-xs text-blue-600\n                                dark:text-blue-400 border border-blue-200 dark:border-blue-800\n                                rounded-xl px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20\n                                min-h-[36px]", children: [_jsx(ExternalLink, { className: "w-3 h-3" }), " View Listing"] }), report.status === "pending" && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => updateStatus(report.id, "actioned"), className: "flex items-center gap-1.5 text-xs text-green-600\n                                         border border-green-200 rounded-xl px-3 py-2\n                                         hover:bg-green-50 dark:hover:bg-green-900/20 min-h-[36px]", children: [_jsx(CheckCircle, { className: "w-3 h-3" }), " Action"] }), _jsxs("button", { onClick: () => updateStatus(report.id, "dismissed"), className: "flex items-center gap-1.5 text-xs text-slate-500\n                                         border border-gray-200 dark:border-slate-600\n                                         rounded-xl px-3 py-2 hover:bg-slate-50\n                                         dark:hover:bg-slate-700/50 min-h-[36px]", children: [_jsx(XCircle, { className: "w-3 h-3" }), " Dismiss"] })] })), isAdmin && (_jsxs("button", { onClick: () => deleteReport(report.id), className: "flex items-center gap-1.5 text-xs text-red-500\n                                       border border-red-200 rounded-xl px-3 py-2\n                                       hover:bg-red-50 dark:hover:bg-red-900/20 min-h-[36px]", children: [_jsx(Trash2, { className: "w-3 h-3" }), " Delete"] }))] })] }) }, report.id))) }))] }));
}
