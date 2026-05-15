import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, getDocs, where, updateDoc, } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Trash2, Download } from "lucide-react";
import { exportToCsv } from "../lib/exportCsv";
function Stars({ rating }) {
    return (_jsx("span", { className: "flex items-center gap-0.5", children: [1, 2, 3, 4, 5].map((i) => (_jsx("span", { className: i <= rating ? "text-amber-400" : "text-slate-200 dark:text-slate-600", children: "\u2605" }, i))) }));
}
export default function ReviewsPage() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const q = query(collection(db, "shopReviews"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error("[ReviewsPage] onSnapshot error:", err);
            setLoading(false);
        });
        return () => unsub();
    }, []);
    async function handleDelete(review) {
        if (!window.confirm("Delete this review? This cannot be undone."))
            return;
        setReviews((prev) => prev.filter((r) => r.id !== review.id));
        try {
            await deleteDoc(doc(db, "shopReviews", review.id));
            const remaining = await getDocs(query(collection(db, "shopReviews"), where("shopId", "==", review.shopId)));
            if (remaining.empty) {
                await updateDoc(doc(db, "shops", review.shopId), { rating: 0, reviewCount: 0 });
            }
            else {
                const total = remaining.docs.reduce((sum, d) => sum + (d.data().rating ?? 0), 0);
                const newAvg = Math.round((total / remaining.size) * 10) / 10;
                await updateDoc(doc(db, "shops", review.shopId), {
                    rating: newAvg,
                    reviewCount: remaining.size,
                });
            }
        }
        catch (err) {
            console.error("[ReviewsPage] delete failed:", err);
            alert("Failed to delete review. Check Firestore permissions.");
            const q2 = query(collection(db, "shopReviews"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q2);
            setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
    }
    function handleExport() {
        const timestamp = new Date().toISOString().slice(0, 10);
        const headers = [
            "ID", "Buyer Name", "Buyer UID",
            "Shop Name", "Shop ID",
            "Shop Listing ID", "Rating", "Comment", "Date",
        ];
        const rows = reviews.map((r) => [
            r.id,
            r.buyerName,
            r.buyerId,
            r.shopName ?? "",
            r.shopId,
            r.shopListingId ?? "",
            r.rating,
            r.comment ?? "",
            new Date(r.createdAt).toLocaleDateString("en-MY", {
                day: "numeric", month: "short", year: "numeric",
            }),
        ]);
        exportToCsv(`reviews_${timestamp}.csv`, headers, rows);
    }
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center gap-3 mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-slate-800 dark:text-slate-200", children: "Reviews" }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-0.5", children: "Moderate user-submitted seller reviews" })] }), !loading && (_jsxs(_Fragment, { children: [_jsxs("span", { className: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300\n                             text-xs font-semibold px-3 py-1 rounded-full", children: [reviews.length, " total"] }), _jsxs("button", { onClick: handleExport, disabled: reviews.length === 0, className: "ml-auto flex items-center gap-2 text-sm font-medium text-slate-600\n                         dark:text-slate-300 border border-gray-200 dark:border-slate-700\n                         bg-white dark:bg-slate-800 rounded-xl px-4 min-h-[40px]\n                         hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-40\n                         disabled:cursor-not-allowed transition-colors", children: [_jsx(Download, { className: "w-4 h-4" }), "Export CSV"] })] }))] }), loading ? (_jsx("div", { className: "space-y-3", children: [...Array(4)].map((_, i) => (_jsx("div", { className: "h-24 bg-white dark:bg-slate-800 rounded-2xl animate-pulse\n                            border border-gray-100 dark:border-slate-700" }, i))) })) : reviews.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center py-24 text-center", children: [_jsx("span", { className: "text-5xl mb-3", children: "\u2B50" }), _jsx("p", { className: "font-semibold text-slate-700 dark:text-slate-300", children: "No reviews yet." }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-1", children: "Reviews submitted by students will appear here." })] })) : (_jsx("div", { className: "space-y-3", children: reviews.map((review) => (_jsx("div", { className: "bg-white dark:bg-slate-800 rounded-2xl p-5 border\n                            border-gray-100 dark:border-slate-700", children: _jsxs("div", { className: "flex items-start gap-4", children: [_jsxs("div", { className: "flex-1 min-w-0 space-y-1", children: [_jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsx(Stars, { rating: review.rating }), _jsx("span", { className: "text-[10px] text-slate-400 dark:text-slate-500", children: new Date(review.createdAt).toLocaleDateString("en-MY", {
                                                    year: "numeric", month: "short", day: "numeric",
                                                }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs mt-1", children: [_jsxs("div", { children: [_jsx("span", { className: "font-medium text-slate-700 dark:text-slate-200", children: review.buyerName || "Unknown" }), _jsx("span", { className: "ml-1.5 text-slate-400 dark:text-slate-500 font-mono text-[10px]", children: review.buyerId })] }), _jsxs("div", { children: [_jsx("span", { className: "text-slate-400 dark:text-slate-500 mr-1", children: "\u2192" }), _jsx("span", { className: "font-medium text-slate-700 dark:text-slate-200", children: review.shopName || "Unknown shop" }), _jsx("span", { className: "ml-1.5 text-slate-400 dark:text-slate-500 font-mono text-[10px]", children: review.shopId })] })] }), _jsxs("p", { className: "text-[11px] italic text-slate-400 dark:text-slate-500 truncate", children: ["Re: ", review.shopListingId ?? "—"] }), review.comment && (_jsxs("p", { className: "text-sm text-slate-700 dark:text-slate-300 leading-snug\n                                  line-clamp-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2 mt-1", children: ["\"", review.comment, "\""] }))] }), _jsxs("button", { onClick: () => handleDelete(review), className: "flex-shrink-0 flex items-center gap-1.5 text-xs text-red-500\n                             border border-red-200 dark:border-red-800 rounded-xl px-3 py-2\n                             hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[36px]", children: [_jsx(Trash2, { className: "w-3 h-3" }), " Delete"] })] }) }, review.id))) }))] }));
}
