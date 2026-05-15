import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { collection, query, orderBy, updateDoc, doc, deleteDoc, addDoc, onSnapshot, getDoc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ExternalLink, Trash2, CheckCircle, XCircle, X } from "lucide-react";
// Helper: lift report hold on a regular listing
async function liftHoldOnListing(listingId) {
    try {
        await updateDoc(doc(db, "listings", listingId), {
            isReportHeld: false,
            reportHeldAt: null,
            isArchived: false,
        });
    }
    catch (e) {
        console.warn("[ReportsPage] liftHoldOnListing skipped:", e);
    }
}
// Helper: lift report hold on a shop listing
async function liftHoldOnShopListing(listingId) {
    try {
        await updateDoc(doc(db, "shopListings", listingId), {
            isReportHeld: false,
            reportHeldAt: null,
            isActive: true,
        });
    }
    catch (e) {
        console.warn("[ReportsPage] liftHoldOnShopListing skipped:", e);
    }
}
// Helper: extract Firebase Storage path from a download URL
function storagePathFromUrl(url) {
    try {
        const u = new URL(url);
        const encoded = u.pathname.split("/o/")[1];
        if (!encoded)
            return null;
        return decodeURIComponent(encoded.split("?")[0]);
    }
    catch {
        return null;
    }
}
const STATUS_COLORS = {
    pending: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    reviewed: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    dismissed: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
    actioned: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
};
const MAIN_APP_URL = import.meta.env.VITE_MAIN_APP_URL ?? "";
export default function ReportsPage() {
    const { adminUser, isAdmin } = useAuth();
    const [reports, setReports] = useState([]);
    const [filter, setFilter] = useState("pending");
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);
    useEffect(() => {
        const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error("[ReportsPage] onSnapshot error:", err);
            alert("Failed to load reports. Check the console for details.");
            setLoading(false);
        });
        return () => unsub();
    }, []);
    async function updateStatus(id, status, report) {
        try {
            await Promise.race([
                updateDoc(doc(db, "reports", id), {
                    status,
                    reviewedBy: adminUser?.uid,
                    reviewedAt: Date.now(),
                }),
                new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 6000)),
            ]);
            if (selectedReport?.id === id) {
                setSelectedReport(prev => prev ? { ...prev, status } : null);
            }
            // Lift the report hold when admin dismisses the report
            if (status === "dismissed" && report) {
                const isShopListing = !!report.shopId;
                if (isShopListing) {
                    await liftHoldOnShopListing(report.listingId);
                }
                else {
                    await liftHoldOnListing(report.listingId);
                }
            }
        }
        catch (e) {
            console.error("[ReportsPage] updateStatus failed:", e);
            alert("Failed to update status. Check the console.");
        }
    }
    async function handleActionAndDelete(report) {
        if (!isAdmin)
            return;
        const confirmed = window.confirm(`This will permanently delete the listing "${report.listingTitle}" and remove this report. Continue?`);
        if (!confirmed)
            return;
        try {
            // Delete Storage photos first to preserve evidence cleanup
            const listingSnap = await getDoc(doc(db, "listings", report.listingId));
            if (listingSnap.exists()) {
                const photos = listingSnap.data().photos ?? [];
                await Promise.allSettled(photos.map((url) => {
                    const path = storagePathFromUrl(url);
                    if (!path)
                        return Promise.resolve();
                    return deleteObject(ref(storage, path)).catch((err) => {
                        if (err?.code !== "storage/object-not-found")
                            console.warn("[ReportsPage] photo delete warn:", err);
                    });
                }));
            }
            await deleteDoc(doc(db, "listings", report.listingId));
            await deleteDoc(doc(db, "reports", report.id));
            await addDoc(collection(db, `users/${report.listingUserId}/notifications`), {
                type: "listing_removed",
                title: "Listing removed",
                body: `Your listing "${report.listingTitle}" was removed by an admin due to a policy violation.`,
                createdAt: Date.now(),
                read: false,
            });
            if (selectedReport?.id === report.id)
                setSelectedReport(null);
        }
        catch (e) {
            console.error("[ReportsPage] delete failed:", e);
            alert("Failed to delete listing/report. Check Firestore permissions.");
        }
    }
    const filtered = filter === "all" ? reports : reports.filter(r => r.status === filter);
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "mb-5", children: [_jsx("h1", { className: "text-xl font-bold text-slate-800 dark:text-slate-200", children: "Reports" }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-0.5", children: "User-submitted listing reports" })] }), _jsx("div", { className: "flex gap-2 mb-5 flex-wrap", children: ["all", "pending", "reviewed", "actioned", "dismissed"].map(s => (_jsxs("button", { onClick: () => setFilter(s), className: `px-4 py-2 rounded-xl text-sm font-medium min-h-[40px]
                              transition-colors capitalize
                              ${filter === s
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700"}`, children: [s, s !== "all" && (_jsxs("span", { className: "ml-1.5 text-[10px] opacity-70", children: ["(", reports.filter(r => r.status === s).length, ")"] }))] }, s))) }), loading ? (_jsx("div", { className: "space-y-3", children: [...Array(4)].map((_, i) => (_jsx("div", { className: "bg-white dark:bg-slate-800 rounded-2xl h-24\n                                    animate-pulse border border-gray-100 dark:border-slate-700" }, i))) })) : filtered.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center py-20 text-center", children: [_jsx("span", { className: "text-5xl mb-3", children: "\uD83C\uDF89" }), _jsxs("p", { className: "font-semibold text-slate-700 dark:text-slate-300", children: ["No ", filter !== "all" ? filter : "", " reports"] })] })) : (_jsx("div", { className: "space-y-3", children: filtered.map(report => (_jsx("div", { onClick: () => setSelectedReport(report), className: "bg-white dark:bg-slate-800 rounded-2xl p-5 border\n                            border-gray-100 dark:border-slate-700 cursor-pointer\n                            hover:border-blue-200 dark:hover:border-blue-700\n                            hover:shadow-sm transition-all", children: _jsxs("div", { className: "flex items-start justify-between gap-4 flex-wrap", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap mb-1", children: [_jsx("span", { className: `text-[10px] font-semibold uppercase tracking-wide
                                      px-2 py-0.5 rounded-full ${STATUS_COLORS[report.status]}`, children: report.status }), _jsx("span", { className: "text-[10px] text-slate-400 capitalize", children: report.category.replace("_", " ") })] }), _jsx("p", { className: "text-sm font-semibold text-slate-800 dark:text-slate-200 truncate", children: report.listingTitle }), _jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-0.5", children: ["Reported by: ", report.reportedByEmail] }), _jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: ["Seller: ", report.listingUserEmail] }), _jsxs("p", { className: "text-sm text-slate-700 dark:text-slate-300 mt-2\n                                bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2 line-clamp-2", children: ["\"", report.reason, "\""] }), _jsx("p", { className: "text-[10px] text-slate-400 mt-1", children: new Date(report.createdAt).toLocaleString() })] }), _jsxs("div", { className: "flex flex-col gap-2 flex-shrink-0", onClick: e => e.stopPropagation(), children: [_jsxs("a", { href: `${MAIN_APP_URL}/listing/${report.listingId}`, target: "_blank", rel: "noopener noreferrer", className: "flex items-center gap-1.5 text-xs text-blue-600\n                                dark:text-blue-400 border border-blue-200 dark:border-blue-800\n                                rounded-xl px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20\n                                min-h-[36px]", children: [_jsx(ExternalLink, { className: "w-3 h-3" }), " View Listing"] }), report.status === "pending" && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => updateStatus(report.id, "actioned"), className: "flex items-center gap-1.5 text-xs text-green-600\n                                         border border-green-200 rounded-xl px-3 py-2\n                                         hover:bg-green-50 dark:hover:bg-green-900/20 min-h-[36px]", children: [_jsx(CheckCircle, { className: "w-3 h-3" }), " Action"] }), _jsxs("button", { onClick: () => updateStatus(report.id, "dismissed", report), className: "flex items-center gap-1.5 text-xs text-slate-500\n                                         border border-gray-200 dark:border-slate-600\n                                         rounded-xl px-3 py-2 hover:bg-slate-50\n                                         dark:hover:bg-slate-700/50 min-h-[36px]", children: [_jsx(XCircle, { className: "w-3 h-3" }), " Dismiss"] })] })), isAdmin && (_jsxs("button", { onClick: () => handleActionAndDelete(report), className: "flex items-center gap-1.5 text-xs text-red-500\n                                       border border-red-200 rounded-xl px-3 py-2\n                                       hover:bg-red-50 dark:hover:bg-red-900/20 min-h-[36px]", children: [_jsx(Trash2, { className: "w-3 h-3" }), " Delete"] }))] })] }) }, report.id))) })), selectedReport && (_jsx("div", { className: "fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4", onClick: () => setSelectedReport(null), children: _jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg\n                          max-h-[90vh] overflow-y-auto", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b\n                            border-gray-100 dark:border-slate-700 sticky top-0\n                            bg-white dark:bg-slate-800 z-10", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5
                                  rounded-full ${STATUS_COLORS[selectedReport.status]}`, children: selectedReport.status }), _jsx("span", { className: "text-xs text-slate-400 capitalize", children: selectedReport.category.replace("_", " ") })] }), _jsx("button", { onClick: () => setSelectedReport(null), className: "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300\n                                 min-h-[44px] flex items-center justify-center w-8", children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsxs("div", { className: "p-5 space-y-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1", children: "Listing" }), _jsx("p", { className: "text-sm font-semibold text-slate-800 dark:text-slate-200", children: selectedReport.listingTitle }), _jsxs("p", { className: "text-xs text-slate-400 mt-0.5 font-mono", children: ["ID: ", selectedReport.listingId] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1", children: "Reporter" }), _jsx("p", { className: "text-xs text-slate-700 dark:text-slate-300 break-all", children: selectedReport.reportedByEmail })] }), _jsxs("div", { children: [_jsx("p", { className: "text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1", children: "Seller" }), _jsx("p", { className: "text-xs text-slate-700 dark:text-slate-300 break-all", children: selectedReport.listingUserEmail })] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1", children: "Reason" }), _jsxs("p", { className: "text-sm text-slate-700 dark:text-slate-300 bg-slate-50\n                              dark:bg-slate-700/50 rounded-xl px-4 py-3 leading-relaxed", children: ["\"", selectedReport.reason, "\""] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1", children: "Submitted" }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-400", children: new Date(selectedReport.createdAt).toLocaleString() })] }), selectedReport.reviewedAt && (_jsxs("div", { children: [_jsx("p", { className: "text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1", children: "Reviewed" }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-400", children: new Date(selectedReport.reviewedAt).toLocaleString() })] }))] }), _jsxs("div", { className: "flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-slate-700", children: [_jsxs("a", { href: `${MAIN_APP_URL}/listing/${selectedReport.listingId}`, target: "_blank", rel: "noopener noreferrer", className: "flex items-center justify-center gap-1.5 text-sm text-blue-600\n                              dark:text-blue-400 border border-blue-200 dark:border-blue-800\n                              rounded-xl px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20\n                              min-h-[44px] transition-colors", children: [_jsx(ExternalLink, { className: "w-4 h-4" }), " View Listing in Marketplace"] }), selectedReport.status === "pending" && (_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("button", { onClick: () => updateStatus(selectedReport.id, "actioned"), className: "flex items-center justify-center gap-1.5 text-sm text-green-600\n                                       border border-green-200 rounded-xl px-4 py-2.5\n                                       hover:bg-green-50 dark:hover:bg-green-900/20 min-h-[44px]", children: [_jsx(CheckCircle, { className: "w-4 h-4" }), " Mark Actioned"] }), _jsxs("button", { onClick: () => updateStatus(selectedReport.id, "dismissed", selectedReport), className: "flex items-center justify-center gap-1.5 text-sm text-slate-500\n                                       border border-gray-200 dark:border-slate-600 rounded-xl px-4\n                                       py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 min-h-[44px]", children: [_jsx(XCircle, { className: "w-4 h-4" }), " Dismiss"] })] })), isAdmin && (_jsxs("button", { onClick: () => handleActionAndDelete(selectedReport), className: "flex items-center justify-center gap-1.5 text-sm text-red-500\n                                     border border-red-200 rounded-xl px-4 py-2.5\n                                     hover:bg-red-50 dark:hover:bg-red-900/20 min-h-[44px]", children: [_jsx(Trash2, { className: "w-4 h-4" }), " Delete Listing & Report"] }))] })] })] }) }))] }));
}
