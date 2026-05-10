import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useRef } from "react";
import { collection, query, orderBy, limit, getDocs, startAfter, deleteDoc, updateDoc, doc, } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { Trash2, Archive, Star } from "lucide-react";
const PAGE_SIZE = 20;
const TYPE_LABELS = {
    "buy-sell": "Buy & Sell",
    "lost-found": "Lost & Found",
    "jobs": "Jobs",
    "assistance": "Assistance",
    "rental": "Rental",
};
const TYPE_COLORS = {
    "buy-sell": "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    "lost-found": "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
    "jobs": "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
    "assistance": "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
    "rental": "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
};
function pathFromUrl(url) {
    const m = url.match(/\/o\/(.+?)(\?|$)/);
    return m ? decodeURIComponent(m[1]) : null;
}
export default function ListingsPage() {
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [typeFilter, setTypeFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [search, setSearch] = useState("");
    const cursorRef = useRef(null);
    async function fetchPage(reset = false) {
        if (reset)
            setLoading(true);
        else
            setLoadingMore(true);
        try {
            const constraints = [orderBy("createdAt", "desc"), limit(PAGE_SIZE + 1)];
            if (!reset && cursorRef.current)
                constraints.push(startAfter(cursorRef.current));
            const snap = await getDocs(query(collection(db, "listings"), ...constraints));
            const docs = snap.docs.slice(0, PAGE_SIZE);
            const more = snap.docs.length > PAGE_SIZE;
            cursorRef.current = docs.length ? docs[docs.length - 1] : null;
            const mapped = docs.map((d) => ({ id: d.id, ...d.data() }));
            if (reset)
                setListings(mapped);
            else
                setListings((prev) => [...prev, ...mapped]);
            setHasMore(more);
        }
        catch (err) {
            console.error("[ListingsPage] fetch failed:", err);
        }
        finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }
    useEffect(() => {
        cursorRef.current = null;
        fetchPage(true);
    }, []);
    async function handleDelete(listing) {
        if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`))
            return;
        setListings((prev) => prev.filter((l) => l.id !== listing.id));
        try {
            await Promise.all(listing.photos.map(async (url) => {
                const path = pathFromUrl(url);
                if (!path)
                    return;
                try {
                    await deleteObject(ref(storage, path));
                }
                catch { }
            }));
            await deleteDoc(doc(db, "listings", listing.id));
        }
        catch (err) {
            console.error("[ListingsPage] delete failed:", err);
            alert("Failed to delete listing. Check Firestore permissions.");
            fetchPage(true);
        }
    }
    async function handleArchive(listing) {
        try {
            await updateDoc(doc(db, "listings", listing.id), { isArchived: true });
            setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, isArchived: true } : l));
        }
        catch (err) {
            console.error("[ListingsPage] archive failed:", err);
            alert("Failed to archive listing.");
        }
    }
    async function handleFeature(listing) {
        try {
            await updateDoc(doc(db, "listings", listing.id), { isFeatured: true });
            setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, isFeatured: true } : l));
        }
        catch (err) {
            console.error("[ListingsPage] feature failed:", err);
            alert("Failed to feature listing.");
        }
    }
    const filtered = listings.filter((l) => {
        if (typeFilter !== "all" && l.type !== typeFilter)
            return false;
        if (statusFilter === "archived" && !l.isArchived)
            return false;
        if (statusFilter === "active" && (l.isArchived || l.status === "sold"))
            return false;
        if (statusFilter === "sold" && l.status !== "sold")
            return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            if (!l.title.toLowerCase().includes(q))
                return false;
        }
        return true;
    });
    return (_jsxs("div", { className: "p-6", children: [_jsx("div", { className: "flex items-center gap-3 mb-6", children: _jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-slate-800 dark:text-slate-200", children: "All Listings" }), _jsxs("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-0.5", children: [listings.length, " loaded", hasMore ? "+" : ""] })] }) }), _jsxs("div", { className: "flex flex-wrap gap-2 mb-5", children: [_jsxs("select", { value: typeFilter, onChange: (e) => setTypeFilter(e.target.value), className: "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700\n                     rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300\n                     min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "all", children: "All Types" }), Object.keys(TYPE_LABELS).map((t) => (_jsx("option", { value: t, children: TYPE_LABELS[t] }, t)))] }), _jsxs("select", { value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700\n                     rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300\n                     min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "all", children: "All Status" }), _jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "sold", children: "Sold" }), _jsx("option", { value: "archived", children: "Archived" })] }), _jsx("input", { value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Search by title\u2026", className: "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700\n                     rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300\n                     min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]" })] }), loading ? (_jsx("div", { className: "space-y-3", children: [...Array(5)].map((_, i) => (_jsx("div", { className: "h-20 bg-white dark:bg-slate-800 rounded-2xl animate-pulse\n                            border border-gray-100 dark:border-slate-700" }, i))) })) : filtered.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center py-24 text-center", children: [_jsx("span", { className: "text-5xl mb-3", children: "\uD83D\uDCED" }), _jsx("p", { className: "font-semibold text-slate-700 dark:text-slate-300", children: "No listings found." }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-1", children: "Try adjusting the filters above." })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "space-y-2", children: filtered.map((listing) => {
                            const statusLabel = listing.isArchived ? "Archived"
                                : listing.status === "sold" ? "Sold" : "Active";
                            const statusColor = listing.isArchived
                                ? "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                                : listing.status === "sold"
                                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                    : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
                            return (_jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-2xl p-4 border\n                                border-gray-100 dark:border-slate-700 flex items-center gap-3", children: [listing.photos.length > 0 ? (_jsx("img", { src: listing.photos[0], alt: listing.title, onError: (e) => { e.target.style.display = "none"; }, className: "w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-slate-100" })) : (_jsx("div", { className: "w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700\n                                    flex items-center justify-center text-xl flex-shrink-0", children: "\uD83D\uDCE6" })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap mb-0.5", children: [_jsx("p", { className: "text-sm font-semibold text-slate-800 dark:text-slate-200 truncate", children: listing.title }), _jsx("span", { className: `text-[10px] font-semibold uppercase tracking-wide
                                        px-2 py-0.5 rounded-full flex-shrink-0
                                        ${TYPE_COLORS[listing.type] ?? "bg-slate-100 text-slate-500"}`, children: TYPE_LABELS[listing.type] ?? listing.type }), _jsx("span", { className: `text-[10px] font-semibold uppercase tracking-wide
                                        px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor}`, children: statusLabel })] }), _jsxs("div", { className: "flex items-center gap-2 text-[11px] text-slate-400 flex-wrap", children: [_jsx("span", { children: listing.category }), listing.price !== undefined && (_jsxs("span", { children: ["\u00B7  ", listing.price === 0 ? "Free" : `RM ${listing.price.toFixed(2)}`] })), listing.viewCount !== undefined && (_jsxs("span", { children: ["\u00B7 ", listing.viewCount, " views"] })), _jsxs("span", { children: ["\u00B7 ", listing.userEmail] }), _jsxs("span", { children: ["\u00B7 ", new Date(listing.createdAt).toLocaleDateString("en-MY", {
                                                                day: "numeric", month: "short", year: "numeric",
                                                            })] })] })] }), _jsxs("div", { className: "flex items-center gap-1 flex-shrink-0", children: [!listing.isArchived && (_jsxs("button", { onClick: () => handleArchive(listing), title: "Archive", className: "flex items-center gap-1 text-[11px] text-amber-600\n                                   border border-amber-200 dark:border-amber-800 rounded-xl\n                                   px-2.5 py-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20\n                                   transition-colors min-h-[34px]", children: [_jsx(Archive, { className: "w-3 h-3" }), " Archive"] })), !listing.isFeatured && (_jsxs("button", { onClick: () => handleFeature(listing), title: "Feature", className: "flex items-center gap-1 text-[11px] text-[#003366]\n                                   dark:text-blue-400 border border-blue-200 dark:border-blue-800\n                                   rounded-xl px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20\n                                   transition-colors min-h-[34px]", children: [_jsx(Star, { className: "w-3 h-3" }), " Feature"] })), _jsxs("button", { onClick: () => handleDelete(listing), title: "Delete", className: "flex items-center gap-1 text-[11px] text-red-500\n                                 border border-red-200 dark:border-red-800 rounded-xl\n                                 px-2.5 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20\n                                 transition-colors min-h-[34px]", children: [_jsx(Trash2, { className: "w-3 h-3" }), " Delete"] })] })] }, listing.id));
                        }) }), hasMore && (_jsx("div", { className: "flex justify-center mt-6", children: _jsx("button", { onClick: () => fetchPage(false), disabled: loadingMore, className: "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700\n                           text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl\n                           px-6 min-h-[44px] hover:bg-slate-50 dark:hover:bg-slate-700/50\n                           disabled:opacity-50 transition-colors", children: loadingMore ? "Loading…" : "Load More" }) }))] }))] }));
}
