import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getListingsPage } from "@/lib/listings";
import { Listing } from "@/lib/types";
import { QueryDocumentSnapshot } from "firebase/firestore";
import ListingCard from "@/components/ListingCard";
import AuthModal from "@/components/AuthModal";
import { ShoppingBag, Search, MapPin, Loader2 } from "lucide-react";

export default function HomePage() {
  const { t } = useLang();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"buy-sell" | "lost-found">("buy-sell");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const loadFirst = useCallback(async (tab: "buy-sell" | "lost-found") => {
    setLoading(true);
    setListings([]);
    setCursor(null);
    setHasMore(false);
    try {
      const result = await getListingsPage(tab, null);
      setListings(result.listings);
      setCursor(result.cursor);
      setHasMore(result.hasMore);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirst(activeTab);
  }, [activeTab, loadFirst]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await getListingsPage(activeTab, cursor);
      setListings((prev) => [...prev, ...result.listings]);
      setCursor(result.cursor);
      setHasMore(result.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  const SkeletonGrid = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-pulse">
          <div className="h-44 bg-gray-100 dark:bg-gray-700" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#003366] via-[#004488] to-[#0055aa] text-white px-4 pt-8 pb-10">
        <div className="max-w-5xl mx-auto">
          <div className="mb-1 inline-flex items-center gap-1.5 bg-white/10 text-white/80 text-xs px-3 py-1 rounded-full">
            <MapPin size={10} />
            Xiamen University Malaysia
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-2 leading-tight">
            {t.hero1}<br />{t.hero2}
          </h1>
          <p className="text-white/70 text-sm mt-2 max-w-sm">{t.heroSub}</p>

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => navigate("/search")}
              className="flex items-center gap-2 bg-white text-[#003366] px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              <Search size={15} />
              {t.browseListings}
            </button>
            {!user && (
              <button
                onClick={() => setShowAuth(true)}
                className="flex items-center gap-2 bg-white/10 text-white border border-white/20 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/20 transition-colors"
              >
                {t.getStarted}
              </button>
            )}
          </div>

          <div className="mt-5 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              onFocus={() => navigate("/search")}
              readOnly
              className="w-full bg-white rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 cursor-pointer shadow-sm focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 sticky top-14 z-30">
        <div className="max-w-5xl mx-auto px-4 flex">
          {(["buy-sell", "lost-found"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 md:flex-none md:px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-[#003366] dark:border-blue-400 text-[#003366] dark:text-blue-400"
                  : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              {tab === "buy-sell" ? t.buySell : t.lostFound}
            </button>
          ))}
        </div>
      </div>

      {/* Listings grid */}
      <div className="max-w-5xl mx-auto px-4 py-5">
        {loading ? (
          <SkeletonGrid />
        ) : listings.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">{t.noListings}</p>
            <p className="text-xs mt-1">{t.beFirstToPost}</p>
            <Link href="/post" className="mt-4 inline-block bg-[#003366] text-white px-5 py-2 rounded-xl text-sm font-semibold">
              {t.postItem}
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>

            {/* Load More */}
            <div className="mt-6 flex justify-center">
              {hasMore ? (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#003366] dark:bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-[#002244] dark:hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? (
                    <><Loader2 size={15} className="animate-spin" /> Loading...</>
                  ) : (
                    t.loadMore
                  )}
                </button>
              ) : listings.length > 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">{t.noMoreListings}</p>
              ) : null}
            </div>
          </>
        )}
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
