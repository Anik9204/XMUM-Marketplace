import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { Link, useLocation } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getListingsPage, getTabCounts } from "@/lib/listings";
import { getActiveAds } from "@/lib/ads";
import { Listing, ListingType, SponsoredAd } from "@/lib/types";
import { QueryDocumentSnapshot } from "firebase/firestore";
import ListingCard from "@/components/ListingCard";
import SponsoredAdCard from "@/components/SponsoredAdCard";
import AuthModal from "@/components/AuthModal";
import { Search, Loader2 } from "lucide-react";

const BUY_SELL_CATEGORIES = [
  "electronics", "books", "clothing", "furniture", "food", "services", "others",
];
const LOST_FOUND_CATEGORIES = ["lostItem", "foundItem"];
const JOBS_CATEGORIES = [
  "tutoring", "freelance_design", "freelance_dev", "language_exchange",
  "photography", "music_lessons", "fitness_coaching", "other_service",
];
const ASSISTANCE_CATEGORIES = [
  "dorm_moving", "grocery_run", "delivery", "cleaning",
  "event_setup", "tech_help", "other_assistance",
];
const RENTAL_VEHICLE_TYPES = ["car", "bike", "motorcycle", "bicycle", "scooter"];

const CATEGORY_ICONS: Record<string, string> = {
  all: "✨",
  electronics: "💻",
  books: "📚",
  clothing: "👕",
  furniture: "🪑",
  food: "🍜",
  services: "🛠️",
  others: "📦",
  lostItem: "🔍",
  foundItem: "📢",
  tutoring: "📖",
  freelance_design: "🎨",
  freelance_dev: "💻",
  language_exchange: "🌐",
  photography: "📷",
  music_lessons: "🎵",
  fitness_coaching: "🏋️",
  other_service: "🛠️",
  dorm_moving: "📦",
  grocery_run: "🛒",
  delivery: "🚴",
  cleaning: "🧹",
  event_setup: "🎉",
  tech_help: "⚙️",
  other_assistance: "🤝",
  car: "🚗",
  bike: "🏍️",
  motorcycle: "🏍️",
  scooter: "🛵",
  bicycle: "🚲",
};

const TAB_ICONS: Record<ListingType, string> = {
  "buy-sell": "🛍️",
  "lost-found": "🔍",
  "jobs": "💼",
  "assistance": "🤝",
  "rental": "🚗",
  "shop-listing": "🏪",
};

const ALL_TABS: ListingType[] = ["buy-sell", "lost-found", "jobs", "assistance", "rental"];

function getCategoriesForTab(tab: ListingType): string[] {
  if (tab === "buy-sell") return BUY_SELL_CATEGORIES;
  if (tab === "lost-found") return LOST_FOUND_CATEGORIES;
  if (tab === "jobs") return JOBS_CATEGORIES;
  if (tab === "rental") return RENTAL_VEHICLE_TYPES;
  return ASSISTANCE_CATEGORIES;
}

export default function HomePage() {
  const { t, lang } = useLang();
  const { user, userProfile } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<ListingType>("buy-sell");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ads, setAds] = useState<SponsoredAd[]>([]);
  const [tabCounts, setTabCounts] = useState<Partial<Record<ListingType, number>>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const chipRowRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(true);

  const tabLabel = (tab: ListingType) => {
    if (tab === "buy-sell") return t.buySell;
    if (tab === "lost-found") return t.lostFound;
    if (tab === "jobs") return t.jobs;
    if (tab === "rental") return t.rental;
    return t.assistance;
  };

  const loadFirst = useCallback(async (tab: ListingType) => {
    setLoading(true);
    setListings([]);
    setCursor(null);
    setHasMore(false);
    try {
      const result = await getListingsPage(tab, null);
      setListings(result.listings);
      setCursor(result.cursor);
      setHasMore(result.hasMore);
    } catch (err: any) {
      const code: string = err?.code ?? err?.message ?? "";
      const isOffline = code.includes("unavailable") || code.includes("offline");
      if (!isOffline) console.error("[HomePage] Failed to load listings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCategoryFilter("all");
    loadFirst(activeTab);
  }, [activeTab, loadFirst]);

  useEffect(() => {
    getActiveAds(2).then(setAds);
  }, []);

  useEffect(() => {
    getTabCounts().then(setTabCounts).catch(() => {});
  }, []);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await getListingsPage(activeTab, cursor);
      setListings((prev) => [...prev, ...result.listings]);
      setCursor(result.cursor);
      setHasMore(result.hasMore);
    } catch (err: any) {
      console.error("[HomePage] Load more failed:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleChipScroll = () => {
    const el = chipRowRef.current;
    if (!el) return;
    setShowLeftShadow(el.scrollLeft > 8);
    setShowRightShadow(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  };

  const handleTabChange = (tab: ListingType) => {
    setActiveTab(tab);
    const el = chipRowRef.current;
    if (el) {
      el.scrollLeft = 0;
      setShowLeftShadow(false);
      setShowRightShadow(el.scrollWidth > el.clientWidth);
    }
  };

  useEffect(() => {
    const el = chipRowRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    handleChipScroll();
    el.addEventListener("scroll", handleChipScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleChipScroll);
  }, [activeTab]);

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSearchFocus = () => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/search");
    }
  };

  const displayedListings = categoryFilter === "all"
    ? listings
    : listings.filter((l) => l.category === categoryFilter);

  const SkeletonGrid = () => (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-slate-700 overflow-hidden animate-pulse">
          <div className="aspect-[4/3] bg-[#F8FAFC] dark:bg-slate-700" />
          <div className="p-3 space-y-2.5">
            <div className="h-2.5 bg-[#E2E8F0] dark:bg-slate-700 rounded-full w-1/3" />
            <div className="h-3.5 bg-[#E2E8F0] dark:bg-slate-700 rounded w-4/5" />
            <div className="h-2.5 bg-[#E2E8F0] dark:bg-slate-700 rounded w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="animate-in fade-in duration-200">
      {/* Hero — not sticky, scrolls away */}
      <div className="bg-gradient-to-br from-[#003366] via-[#004488] to-[#0055CC] text-white px-4 pt-8 pb-10">
        <div className="max-w-5xl mx-auto">
          {user && userProfile && (
            <p className="text-sm text-white/70 mb-1">
              Good day, {userProfile.displayName} 👋
            </p>
          )}
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1 leading-tight">
            {t.hero1}<br />{t.hero2}
          </h1>
          <p className="text-white/70 text-sm mt-2 max-w-sm">{t.heroSub}</p>
        </div>
      </div>

      {/* ── Sticky group: search + tabs + chips ── */}
      <div data-sticky-subheader className="sticky top-14 sm:top-16 z-30 bg-white dark:bg-[#1E293B] shadow-sm">

        {/* Search bar */}
        <div className="border-b border-[#E2E8F0] dark:border-slate-700 px-4 py-2.5">
          <div className="max-w-xl mx-auto relative">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={handleSearchFocus}
              onKeyDown={handleSearchKey}
              placeholder="Search listings, services, rentals..."
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 dark:focus:ring-blue-500/30 focus:border-[#003366] dark:focus:border-blue-500 transition-all cursor-pointer"
              readOnly
            />
            {!user && (
              <button
                onClick={() => setShowAuth(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#003366] dark:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#002244] dark:hover:bg-blue-700 transition-colors"
              >
                {t.getStarted}
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="border-b border-[#E2E8F0] dark:border-slate-700">
          <div className="max-w-5xl mx-auto px-4 flex overflow-x-auto scrollbar-hide">
            {ALL_TABS.map((tab) => {
              const count = tabCounts[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`
                    flex-shrink-0 md:flex-1 flex items-center gap-1.5 py-3 px-3 md:px-4
                    text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap
                    transition-all duration-200 justify-center
                    ${isActive
                      ? "border-[#003366] dark:border-blue-400 text-[#003366] dark:text-blue-400"
                      : "border-transparent text-[#64748B] dark:text-slate-500 hover:text-[#0F172A] dark:hover:text-slate-300"
                    }
                  `}
                >
                  <span className="text-base leading-none">{TAB_ICONS[tab]}</span>
                  <span>{tabLabel(tab)}</span>
                  {count != null && count > 0 && (
                    <span
                      className={`
                        text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none
                        ${isActive
                          ? "bg-[#003366] dark:bg-blue-500 text-white"
                          : "bg-[#F1F5F9] dark:bg-slate-700 text-[#64748B] dark:text-slate-400"
                        }
                      `}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category chips with scroll shadow gradients */}
        <div className="relative border-b border-[#E2E8F0] dark:border-slate-700">
          {showLeftShadow && (
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-r from-white dark:from-[#1E293B] to-transparent" />
          )}
          {showRightShadow && (
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-l from-white dark:from-[#1E293B] to-transparent" />
          )}
          <div
            ref={chipRowRef}
            className="max-w-5xl mx-auto flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2.5"
          >
            {["all", ...getCategoriesForTab(activeTab)].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`
                  flex-shrink-0 min-h-[36px] min-w-fit px-3.5 whitespace-nowrap
                  flex items-center gap-1.5 rounded-full text-xs font-medium
                  border transition-all duration-150
                  ${categoryFilter === cat
                    ? "bg-[#003366] text-white border-[#003366] shadow-sm dark:bg-blue-600 dark:border-blue-600"
                    : "bg-white dark:bg-slate-800 text-[#64748B] dark:text-slate-300 border-[#E2E8F0] dark:border-slate-600 hover:border-[#003366] hover:text-[#003366] dark:hover:border-blue-400"
                  }
                `}
              >
                <span>{CATEGORY_ICONS[cat] ?? "📦"}</span>
                <span>{cat === "all" ? (lang === "en" ? "All" : "全部") : t.categories[cat as keyof typeof t.categories]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* ── End sticky group ── */}

      {/* "Near You" location context — mobile only */}
      <div className="md:hidden max-w-5xl mx-auto px-4 pt-3 pb-0">
        <p className="text-xs text-gray-400 dark:text-slate-500 italic">
          📍 XMUM Campus, Sepang
        </p>
      </div>

      {/* Signup nudge — unauthenticated users only */}
      {!user && (
        <div className="max-w-5xl mx-auto px-4 mt-3">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-blue-700 dark:text-blue-300">
              🎓 Exclusive to XMUM students
            </span>
            <button
              onClick={() => setShowAuth(true)}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 underline min-h-[44px]"
            >
              Sign up free
            </button>
          </div>
        </div>
      )}

      {ads.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 mt-4">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Sponsored</p>
          <SponsoredAdCard ad={ads[0]} />
        </div>
      )}

      {/* Listings grid */}
      <div className="max-w-5xl mx-auto px-4 py-5">
        {loading ? (
          <SkeletonGrid />
        ) : displayedListings.length === 0 ? (
          <div className="col-span-full flex flex-col items-center py-16 text-center">
            <span className="text-5xl mb-4">🛍️</span>
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No listings yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Be the first to post something!</p>
            {categoryFilter !== "all" ? (
              <button onClick={() => setCategoryFilter("all")} className="mt-4 inline-block text-[#003366] dark:text-blue-400 text-sm font-semibold underline">
                Show all categories
              </button>
            ) : (
              <Link href="/post" className="mt-4 inline-block bg-[#003366] dark:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#002244] dark:hover:bg-blue-700 transition-colors">
                {t.postItem}
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {displayedListings.length} {displayedListings.length === 1 ? "listing" : "listings"}
                {categoryFilter !== "all" && ` in ${t.categories[categoryFilter as keyof typeof t.categories] ?? categoryFilter}`}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedListings.map((listing, i) => (
                <Fragment key={listing.id}>
                  <ListingCard listing={listing} showSaveButton />
                  {(i + 1) % 6 === 0 && ads[1] && (
                    <>
                      <p className="col-span-full text-[10px] font-medium text-slate-400 uppercase tracking-wide -mb-2">Sponsored</p>
                      <div className="col-span-full"><SponsoredAdCard ad={ads[1]} /></div>
                    </>
                  )}
                </Fragment>
              ))}
            </div>

            {categoryFilter === "all" && (
              <div className="mt-6 flex justify-center">
                {hasMore ? (
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-6 py-2.5 min-h-[44px] bg-white dark:bg-[#1E293B] text-[#003366] dark:text-blue-400 border border-[#E2E8F0] dark:border-slate-700 rounded-full text-sm font-semibold hover:border-[#003366] dark:hover:border-blue-500 disabled:opacity-50 transition-all duration-200 shadow-card"
                  >
                    {loadingMore ? (
                      <><Loader2 size={15} className="animate-spin" /> {t.loading}</>
                    ) : (
                      t.loadMore
                    )}
                  </button>
                ) : listings.length > 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500">{t.noMoreListings}</p>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
