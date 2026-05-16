import { useEffect, useState } from "react";
import { ExternalLink, Trash2, Search } from "lucide-react";
import { getShops, deleteShop, writeAuditLog } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { AdminShop } from "../lib/types";

export default function ShopsPage() {
  const { adminUser } = useAuth();
  const [shops, setShops] = useState<AdminShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getShops(200);
      setShops(data as AdminShop[]);
    } catch (e) {
      console.error("[ShopsPage] load failed:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(shop: AdminShop) {
    if (!window.confirm(`Delete shop "${shop.shopName}"? This cannot be undone.`)) return;
    setDeleting(shop.id);
    try {
      await deleteShop(shop.id);
      setShops((prev) => prev.filter((s) => s.id !== shop.id));
      void writeAuditLog({
        actorUid:    adminUser?.uid   ?? "",
        actorEmail:  adminUser?.email ?? "",
        action:      "shop_deleted",
        label:       `Deleted shop "${shop.shopName}"`,
        targetId:    shop.id,
        targetType:  "shop",
        targetLabel: shop.shopName,
        createdAt:   Date.now(),
      });
    } catch (e) {
      console.error("[ShopsPage] delete failed:", e);
      alert("Failed to delete shop. Check Firestore permissions.");
    } finally {
      setDeleting(null);
    }
  }

  const allCategories = Array.from(
    new Set(shops.flatMap((s) => s.shopCategories ?? []))
  ).sort();

  const filtered = shops.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.shopName?.toLowerCase().includes(q) ||
      s.ownerEmail?.toLowerCase().includes(q);
    const matchesCategory =
      !categoryFilter ||
      (s.shopCategories ?? []).includes(categoryFilter);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
            Campus Market Shops
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {loading ? "Loading…" : `${shops.length} total shop${shops.length !== 1 ? "s" : ""}`}
            {!loading && filtered.length !== shops.length && ` · ${filtered.length} shown`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by shop name or owner email…"
            className="w-full pl-9 bg-white dark:bg-slate-800 border border-gray-200
                       dark:border-slate-700 rounded-xl px-3 py-2 text-sm
                       text-slate-700 dark:text-slate-300 min-h-[40px]
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {allCategories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                       rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300
                       min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white dark:bg-slate-800 rounded-2xl
                                    animate-pulse border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <span className="text-5xl mb-3">🏪</span>
          <p className="font-semibold text-slate-700 dark:text-slate-300">No shops found</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {search || categoryFilter ? "Try adjusting your filters." : "No shops have been created yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100
                        dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700
                               text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="text-left px-4 py-3 font-medium">Shop Name</th>
                  <th className="text-left px-4 py-3 font-medium">Owner Email</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-right px-4 py-3 font-medium">Listings</th>
                  <th className="text-right px-4 py-3 font-medium">Inquiries</th>
                  <th className="text-right px-4 py-3 font-medium">Rating</th>
                  <th className="text-left px-4 py-3 font-medium">Created At</th>
                  <th className="px-4 py-3 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {filtered.map((shop) => (
                  <tr key={shop.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {shop.shopBannerUrl && (
                          <img
                            src={shop.shopBannerUrl}
                            alt={shop.shopName}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0 bg-slate-100"
                          />
                        )}
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {shop.shopName || "—"}
                          </p>
                          {shop.shopSlug && (
                            <p className="text-[10px] text-slate-400">/{shop.shopSlug}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                      {shop.ownerEmail || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {(shop.shopCategories ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(shop.shopCategories ?? []).slice(0, 2).map((c) => (
                            <span key={c}
                                  className="text-[10px] px-1.5 py-0.5 rounded-full
                                             bg-blue-50 dark:bg-blue-900/30
                                             text-blue-600 dark:text-blue-400 font-medium">
                              {c}
                            </span>
                          ))}
                          {(shop.shopCategories ?? []).length > 2 && (
                            <span className="text-[10px] text-slate-400">
                              +{(shop.shopCategories ?? []).length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {shop.activeListingCount ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {shop.inquiryCount ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {shop.rating != null ? (
                        <span className="text-amber-500 font-medium">
                          ★ {shop.rating.toFixed(1)}
                          <span className="text-slate-400 font-normal text-[10px] ml-0.5">
                            ({shop.totalReviews ?? 0})
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {shop.createdAt
                        ? new Date(shop.createdAt).toLocaleDateString("en-MY", {
                            day: "numeric", month: "short", year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {shop.shopSlug && (
                          <a
                            href={`/shop/${shop.shopSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View public shop page"
                            className="flex items-center gap-1 text-[11px] text-blue-600
                                       dark:text-blue-400 border border-blue-200
                                       dark:border-blue-800 rounded-xl px-2.5 py-1.5
                                       hover:bg-blue-50 dark:hover:bg-blue-900/20
                                       transition-colors min-h-[34px]"
                          >
                            <ExternalLink className="w-3 h-3" /> View
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(shop)}
                          disabled={deleting === shop.id}
                          title="Delete shop"
                          className="flex items-center gap-1 text-[11px] text-red-500
                                     border border-red-200 dark:border-red-800 rounded-xl
                                     px-2.5 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20
                                     transition-colors min-h-[34px] disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          {deleting === shop.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
