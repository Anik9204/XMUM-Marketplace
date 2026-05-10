import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { FileText, Loader2 } from "lucide-react";
function formatDate(ms) {
    return new Date(ms).toLocaleString("en-MY", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
}
export default function RentalAuditPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        async function fetchLogs() {
            try {
                const q = query(collection(db, "rentalAuditLogs"), orderBy("acceptedAt", "desc"));
                const snap = await getDocs(q);
                setLogs(snap.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                })));
            }
            catch (err) {
                setError(err?.message ?? "Failed to load audit logs.");
            }
            finally {
                setLoading(false);
            }
        }
        fetchLogs();
    }, []);
    return (_jsxs("div", { className: "p-6 max-w-7xl mx-auto", children: [_jsxs("div", { className: "mb-6 flex items-center gap-3", children: [_jsx("div", { className: "w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center", children: _jsx(FileText, { className: "w-5 h-5 text-amber-600 dark:text-amber-400" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-slate-800 dark:text-slate-100", children: "Rental T&C Audit Log" }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-0.5", children: "Permanent, tamper-proof record of Rental Disclaimer acceptances. Never deleted." })] }), _jsxs("div", { className: "ml-auto bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium", children: [logs.length, " record", logs.length !== 1 ? "s" : ""] })] }), _jsx("div", { className: "bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3 mb-6 text-xs text-yellow-800 dark:text-yellow-300", children: "\u26A0\uFE0F These records are retained for legal compliance under Malaysian law (PDPA 2010) and may be required in dispute resolution. Data in this collection persists even after user account or listing deletion." }), loading && (_jsx("div", { className: "flex items-center justify-center py-20", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin text-slate-400" }) })), error && (_jsx("div", { className: "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400", children: error })), !loading && !error && logs.length === 0 && (_jsxs("div", { className: "text-center py-20 text-slate-400 dark:text-slate-500", children: [_jsx(FileText, { className: "w-10 h-10 mx-auto mb-3 opacity-30" }), _jsx("p", { className: "text-sm", children: "No rental T&C acceptances recorded yet." })] })), !loading && !error && logs.length > 0 && (_jsx("div", { className: "bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-600", children: [_jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap", children: "Accepted At" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap", children: "User Email" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap", children: "User ID" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap", children: "Listing" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap", children: "Listing ID" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap", children: "TC Version" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide", children: "User Agent" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100 dark:divide-slate-700", children: logs.map((log) => (_jsxs("tr", { className: "hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors", children: [_jsx("td", { className: "px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap font-mono", children: formatDate(log.acceptedAt) }), _jsx("td", { className: "px-4 py-3 text-xs text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap", children: log.userEmail }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded", children: log.userId }) }), _jsx("td", { className: "px-4 py-3 text-xs text-slate-700 dark:text-slate-200 max-w-[200px] truncate", children: log.listingTitle }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded", children: log.listingId }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium", children: log.tcVersion }) }), _jsx("td", { className: "px-4 py-3 text-[10px] text-slate-400 dark:text-slate-500 max-w-[240px] truncate", title: log.userAgent, children: log.userAgent })] }, log.id))) })] }) }) }))] }));
}
