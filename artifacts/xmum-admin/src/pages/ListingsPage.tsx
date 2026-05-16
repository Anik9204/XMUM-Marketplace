import { useEffect, useState, useRef } from "react";
import {
  collection, query, orderBy, limit, getDocs, where,
  startAfter, deleteDoc, updateDoc, doc,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage, writeAuditLog } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { AdminListing, ListingType } from "../lib/types";
import { Trash2, Archive, Star, Download } from "lucide-react";
import { exportToCsv } from "../lib/exportCsv";

const PAGE_SIZE = 20;

const TYPE_LABELS: Record<ListingType, string> = {
  "buy-sell":   "Buy & Sell",
  "lost-found": "Lost & Found",
  "jobs":       "Jobs",
  "assistance": "Assistance",
  "rental":     "Rental",
};

const TYPE_COLORS: Record<ListingType, string> = {
  "buy-sell":   "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  "lost-found": "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
  "jobs":       "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  "assistance": "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  "rental":     "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
};

type StatusFilter = "all" | "active" | "sold" | "archived";

function pathFromUrl(url: string): string | null {
  const m = url.match(/\/o\/(.+?)(\?|$)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function ListingsPage() {
  const { adminUser } = useAuth();
  const [listings, setListings]   = useState<AdminListing[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]     = useState(false);
  const [typeFilter, setTypeFilter]   = useState<ListingType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch]       = useState("");
  const cursorRef = useRef<QueryDocumentSnapshot | null>(null);

  async function fetchPage(reset = false, type = typeFilter, status = statusFilter) {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const constraints: any[] = [orderBy("createdAt", "desc"), limit(PAGE_SIZE + 1)];
      if (type !== "all") {
        constraints.unshift(where("type", "==", type));
      }
      if (status === "active") {
        constraints.unshift(where("isArchived", "==", false));
      } else if (status === "archived") {
        constraints.unshift(where("isArchived", "==", true));
      } else if (status === "sold") {
        constraints.unshift(where("status", "==", "sold"));
      }
      if (!reset && cursorRef.current) constraints.push(startAfter(cursorRef.current));

      const snap = await getDocs(query(collection(db, "listings"), ...constraints));
      const docs = snap.docs.slice(0, PAGE_SIZE);
      const more = snap.docs.length > PAGE_SIZE;
      cursorRef.current = docs.length ? docs[docs.length - 1] : null;

      const mapped = docs.map((d) => ({ id: d.id, ...d.data() } as AdminListing));
      if (reset) setListings(mapped);
      else setListings((prev) => [...prev, ...mapped]);
      setHasMore(more);
    } catch (err) {
      console.error("[ListingsPage] fetch failed:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    cursorRef.current = null;
    fetchPage(true, typeFilter, statusFilter);
  }, [typeFilter, statusFilter]);

  async function handleDelete(listing: AdminListing) {
    if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`)) return;

    setListings((prev) => prev.filter((l) => l.id !== listing.id));

    try {
      await Promise.all(
        listing.photos.map(async (url) => {
          const path = pathFromUrl(url);
          if (!path) return;
          try { await deleteObject(ref(storage, path)); } catch {}
        })
      );
      await deleteDoc(doc(db, "listings", listing.id));
      void writeAuditLog({
        actorUid:    adminUser?.uid   ?? "",
        actorEmail:  adminUser?.email ?? "",
        action:      "listing_deleted",
        label:       `Deleted listing "${listing.title}"`,
        targetId:    listing.id,
        targetType:  "listing",
        targetLabel: listing.title,
        createdAt:   Date.now(),
      });
    } catch (err) {
      console.error("[ListingsPage] delete failed:", err);
      alert("Failed to delete listing. Check Firestore permissions.");
      fetchPage(true);
    }
  }

  async function handleArchive(listing: AdminListing) {
    try {
      await updateDoc(doc(db, "listings", listing.id), { isArchived: true });
      setListings((prev) =>
        prev.map((l) => l.id === listing.id ? { ...l, isArchived: true } : l)
      );
      void writeAuditLog({
        actorUid:    adminUser?.uid   ?? "",
        actorEmail:  adminUser?.email ?? "",
        action:      "listing_archived",
        label:       `Archived listing "${listing.title}"`,
        targetId:    listing.id,
        targetType:  "listing",
        targetLabel: listing.title,
        createdAt:   Date.now(),
      });
    } catch (err) {
      console.error("[ListingsPage] archive failed:", err);
      alert("Failed to archive listing.");
    }
  }

  async function handleFeature(listing: AdminListing) {
    try {
      await updateDoc(doc(db, "listings", listing.id), { isFeatured: true });
      setListings((prev) =>
        prev.map((l) => l.id === listing.id ? { ...l, isFeatured: true } : l)
      );
      void writeAuditLog({
        actorUid:    adminUser?.uid   ?? "",
        actorEmail:  adminUser?.email ?? "",
        action:      "listing_featured",
        label:       `Featured listing "${listing.title}"`,
        targetId:    listing.id,
        targetType:  "listing",
        targetLabel: listing.title,
        createdAt:   Date.now(),
      });
    } catch (err) {
      console.error("[ListingsPage] feature failed:", err);
      alert("Failed to feature listing.");
    }
  }

  const filtered = listings.filter((l) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!l.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function handleExport() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const headers = [
      "ID", "Title", "Type", "Category", "Price (RM)",
      "Status", "Poster Email", "Poster Name",
      "Views", "Featured", "Photos", "Created At",
    ];
    const rows = filtered.map((l) => [
      l.id,
      l.title,
      TYPE_LABELS[l.type] ?? l.type,
      l.category,
      l.price === 0 ? "Free" : l.price ?? "",
      l.isArchived ? "Archived" : l.status === "sold" ? "Sold" : "Active",
      l.userEmail,
      l.userName,
      l.viewCount ?? 0,
      l.isFeatured ? "Yes" : "No",
      l.photos.length,
      new Date(l.createdAt).toLocaleDateString("en-MY", {
        day: "numeric", month: "short", year: "numeric",
      }),
    ]);
    exportToCsv(`listings_${timestamp}.csv`, headers, rows);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">All Listings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {listings.length} loaded{hasMore ? "+" : ""}
            {filtered.length !== listings.length && ` · ${filtered.length} shown`}
          </p>
        </div>
        {!loading && (
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 text-sm font-medium text-slate-600
                       dark:text-slate-300 border border-gray-200 dark:border-slate-700
                       bg-white dark:bg-slate-800 rounded-xl px-4 min-h-[40px]
                       hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-40
                       disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ListingType | "all")}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                     rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300
                     min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          {(Object.keys(TYPE_LABELS) as ListingType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                     rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300
                     min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="sold">Sold</option>
          <option value="archived">Archived</option>
        </select>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title…"
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                     rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300
                     min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[200px]"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i}
                 className="h-20 bg-white dark:bg-slate-800 rounded-2xl animate-pulse
                            border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <span className="text-5xl mb-3">📭</span>
          <p className="font-semibold text-slate-700 dark:text-slate-300">No listings found.</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Try adjusting the filters above.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {filtered.map((listing) => {
              const statusLabel = listing.isArchived ? "Archived"
                : listing.status === "sold" ? "Sold" : "Active";
              const statusColor = listing.isArchived
                ? "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                : listing.status === "sold"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";

              return (
                <div key={listing.id}
                     className="bg-white dark:bg-slate-800 rounded-2xl p-4 border
                                border-gray-100 dark:border-slate-700 flex items-center gap-3">
                  {listing.photos.length > 0 ? (
                    <img
                      src={listing.photos[0]}
                      alt={listing.title}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-slate-100"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700
                                    flex items-center justify-center text-xl flex-shrink-0">
                      📦
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {listing.title}
                      </p>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide
                                        px-2 py-0.5 rounded-full flex-shrink-0
                                        ${TYPE_COLORS[listing.type] ?? "bg-slate-100 text-slate-500"}`}>
                        {TYPE_LABELS[listing.type] ?? listing.type}
                      </span>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide
                                        px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                      <span>{listing.category}</span>
                      {listing.price !== undefined && (
                        <span>·  {listing.price === 0 ? "Free" : `RM ${listing.price.toFixed(2)}`}</span>
                      )}
                      {listing.viewCount !== undefined && (
                        <span>· {listing.viewCount} views</span>
                      )}
                      <span>· {listing.userEmail}</span>
                      <span>· {new Date(listing.createdAt).toLocaleDateString("en-MY", {
                        day: "numeric", month: "short", year: "numeric",
                      })}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!listing.isArchived && (
                      <button
                        onClick={() => handleArchive(listing)}
                        title="Archive"
                        className="flex items-center gap-1 text-[11px] text-amber-600
                                   border border-amber-200 dark:border-amber-800 rounded-xl
                                   px-2.5 py-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20
                                   transition-colors min-h-[34px]"
                      >
                        <Archive className="w-3 h-3" /> Archive
                      </button>
                    )}
                    {!listing.isFeatured && (
                      <button
                        onClick={() => handleFeature(listing)}
                        title="Feature"
                        className="flex items-center gap-1 text-[11px] text-[#003366]
                                   dark:text-blue-400 border border-blue-200 dark:border-blue-800
                                   rounded-xl px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20
                                   transition-colors min-h-[34px]"
                      >
                        <Star className="w-3 h-3" /> Feature
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(listing)}
                      title="Delete"
                      className="flex items-center gap-1 text-[11px] text-red-500
                                 border border-red-200 dark:border-red-800 rounded-xl
                                 px-2.5 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20
                                 transition-colors min-h-[34px]"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => fetchPage(false, typeFilter, statusFilter)}
                disabled={loadingMore}
                className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                           text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl
                           px-6 min-h-[44px] hover:bg-slate-50 dark:hover:bg-slate-700/50
                           disabled:opacity-50 transition-colors"
              >
                {loadingMore ? "Loading…" : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
