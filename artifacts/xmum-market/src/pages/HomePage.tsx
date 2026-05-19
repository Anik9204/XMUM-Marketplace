import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { Link, useLocation } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getListingsPage, getTabCounts } from "@/lib/listings";
import { getActiveAds } from "@/lib/ads";
import { getFeaturedShops, getRecentShopListings } from "@/lib/shops";
import { Listing, ListingType, SponsoredAd, Shop, ShopListing } from "@/lib/types";
import { QueryDocumentSnapshot, collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ListingCard from "@/components/ListingCard";
import SponsoredAdCard from "@/components/SponsoredAdCard";
import AuthModal from "@/components/AuthModal";
import { Search, Loader2, Store, Star, ChevronRight } from "lucide-react";

const BUY_SELL_CATEGORIES = [
  "electronics", "books", "clothing", "furniture", "food", "services", "car", "motorcycle", "others",
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
const RENTAL_VEHICLE_TYPES = ["car", "motorcycle", "bicycle", "electric-bike"];

const CATEGORY_ICONS: Record<string, string> = {
  all: "✨",
  electronics: "💻",
  books: "📚",
  clothing: "👕",
  furniture: "🪑",
  food: "🍳",
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
  motorcycle: "🏍️",
  "electric-bike": "⚡",
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

function StarRowSmall({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={9}
          className={n <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-gray-300 dark:text-slate-600"}
        />
      ))}
    </div>
  );
}

function ShopPillCard({ shop }: { shop: Shop }) {
  return (
    <Link href={`/shop/${shop.slug}`}>
      <div className="flex flex-col items-center w-[80px] shrink-0 cursor-pointer group">
        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm group-hover:shadow-md group-hover:border-[#003366] dark:group-hover:border-blue-500 transition-all flex items-center justify-center mb-1.5">
          {shop.logoUrl ? (
            <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover" />
          ) : (
            <Store size={24} className="text-[#003366] dark:text-blue-400" />
          )}
        </div>
        <p className="text-[11px] font-bold font-display text-gray-800 dark:text-slate-200 text-center line-clamp-1 w-full leading-tight">
          {shop.name}
        </p>
        {(shop.reviewCount ?? 0) > 0 ? (
          <div className="flex items-center gap-0.5 mt-0.5">
            <StarRowSmall rating={shop.rating ?? 0} />
            <span className="text-[9px] text-gray-400 dark:text-slate-500">{(shop.rating ?? 0).toFixed(1)}</span>
          </div>
        ) : (
          <p className="text-[9px] text-gray-400 dark:text-slate-500 text-center truncate w-full mt-0.5">
            {shop.category.split(" ")[0]}
          </p>
        )}
      </div>
    </Link>
  );
}

function ShopListingMiniCard({ listing }: { listing: ShopListing }) {
  const [, navigate] = useLocation();
  return (
    <div
      onClick={() => navigate(`/shop-listing/${listing.id}`)}
      className="card-base overflow-hidden transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
    >
      {listing.photos[0] ? (
        <img src={listing.photos[0]} alt={listing.title} className="w-full aspect-[4/3] object-cover" />
      ) : (
        <div className="w-full aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
          <Store size={18} className="text-gray-300 dark:text-slate-500" />
        </div>
      )}
      <div className="p-1.5">
        <p className="text-[10px] font-semibold font-display text-gray-900 dark:text-slate-100 line-clamp-1 leading-tight mb-0.5">
          {listing.title}
        </p>
        {listing.price != null ? (
          <p className="text-[11px] font-bold text-[#003366] dark:text-blue-400 leading-tight">
            RM {listing.price.toFixed(2)}
            {listing.pricingModel && listing.pricingModel !== "fixed" && (
              <span className="font-normal text-[9px] text-gray-400">
                /{listing.pricingModel.replace("per_", "")}
              </span>
            )}
          </p>
        ) : (
          <p className="text-[10px] text-gray-400 dark:text-slate-500">Contact</p>
        )}
        <p className="text-[9px] text-gray-400 dark:text-slate-500 truncate">{listing.shopName}</p>
      </div>
    </div>
  );
}

function getLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || fullName.trim();
}

export default function HomePage() {
  const { t, lang } = useLang();
  const { user, userProfile } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<ListingType>("buy-sell");
  useEffect(() => {
    sessionStorage.setItem("xmum_home_active_tab", activeTab);
  }, [activeTab]);
  useEffect(() => {
    return () => {
      sessionStorage.removeItem("xmum_home_active_tab");
    };
  }, []);
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
  const [featuredShops, setFeaturedShops] = useState<Shop[]>([]);
  const [recentShopListings, setRecentShopListings] = useState<ShopListing[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const chipRowRef = useRef<HTMLDivElement>(null);
  const listingsRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(true);
  const [newItemsBuffer, setNewItemsBuffer] = useState<Listing[]>([]);
  const pageLoadTsRef = useRef<number>(Date.now());
  const [shopListingPage, setShopListingPage] = useState(0);
  const shopCarouselRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shopUserInteractedRef = useRef(false);
  const shopInteractTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shopTouchStartX = useRef<number | null>(null);

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

  useEffect(() => {
    setLoadingShops(true);
    Promise.all([
      getFeaturedShops(8),
      getRecentShopListings(18),
    ]).then(([shops, listings]) => {
      setFeaturedShops(shops);
      setRecentShopListings(listings);
    }).catch(() => {}).finally(() => setLoadingShops(false));
  }, []);

  useEffect(() => {
    pageLoadTsRef.current = Date.now();
    setNewItemsBuffer([]);

    const q = query(
      collection(db, "listings"),
      where("type", "==", activeTab),
      where("isArchived", "==", false),
      where("createdAt", ">", pageLoadTsRef.current),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const newListing = { id: change.doc.id, ...change.doc.data() } as Listing;
          if (categoryFilter && categoryFilter !== "all" && newListing.category !== categoryFilter) return;
          setNewItemsBuffer((prev) =>
            prev.some((l) => l.id === newListing.id) ? prev : [newListing, ...prev]
          );
        }
      });
    }, () => {});

    return () => unsub();
  }, [activeTab, categoryFilter]);

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
    sessionStorage.setItem("xmum_home_active_tab", tab);
    window.dispatchEvent(new CustomEvent("xmum_home_tab", { detail: tab }));
    setShopListingPage(0);
    const el = chipRowRef.current;
    if (el) {
      el.scrollLeft = 0;
      setShowLeftShadow(false);
      setShowRightShadow(el.scrollWidth > el.clientWidth);
    }
    setTimeout(() => {
      const listEl = listingsRef.current;
      if (listEl) {
        const top = listEl.getBoundingClientRect().top + window.scrollY - 130;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }, 50);
  };

  useEffect(() => {
    const el = chipRowRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    handleChipScroll();
    el.addEventListener("scroll", handleChipScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleChipScroll);
  }, [activeTab]);

  const SHOP_PAGE_SIZE = 6;

  useEffect(() => {
    const totalPages = Math.ceil(recentShopListings.length / SHOP_PAGE_SIZE);
    if (totalPages <= 1) return;
    const start = () => {
      shopCarouselRef.current = setInterval(() => {
        if (!shopUserInteractedRef.current) {
          setShopListingPage((p) => (p + 1) % totalPages);
        }
      }, 4000);
    };
    start();
    return () => {
      if (shopCarouselRef.current) clearInterval(shopCarouselRef.current);
    };
  }, [recentShopListings.length]);

  const handleShopPageChange = (newPage: number) => {
    setShopListingPage(newPage);
    shopUserInteractedRef.current = true;
    if (shopInteractTimerRef.current) clearTimeout(shopInteractTimerRef.current);
    shopInteractTimerRef.current = setTimeout(() => {
      shopUserInteractedRef.current = false;
    }, 8000);
  };

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
      <style>{`
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-fade-up { animation: heroFadeUp both; }
        @keyframes heroShimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes shopSlideIn {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .shop-picks-wrapper { min-height: 360px; }
        @media (min-width: 640px) {
          .shop-picks-wrapper { min-height: unset; }
        }
      `}</style>
      <div key={activeTab} className="relative overflow-hidden bg-gradient-to-br from-[#003366] via-[#004488] to-[#0055CC] text-white px-4 pt-8 pb-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)",
            backgroundSize: "200% 100%",
            animation: "heroShimmer 3.5s ease-in-out infinite",
          }}
        />
        <div className="max-w-5xl mx-auto">
          {user && userProfile && (
            <p
              className="hero-fade-up text-sm text-white/70 mb-1"
              style={{ animationDuration: "400ms", animationDelay: "0ms", animationFillMode: "both" }}
            >
              Good day, {getLastName(userProfile.fullName || userProfile.displayName)} 👋
            </p>
          )}
          <h1
            className="hero-fade-up text-xl sm:text-2xl lg:text-3xl font-bold mt-1 leading-tight"
            style={{ animationDuration: "500ms", animationDelay: "80ms", animationFillMode: "both" }}
          >
            {t.hero1}<br />{t.hero2}
          </h1>
          <p
            className="hero-fade-up text-white/70 text-sm mt-2 max-w-sm"
            style={{ animationDuration: "500ms", animationDelay: "180ms", animationFillMode: "both" }}
          >{t.heroSub}</p>
        </div>
      </div>

      {/* ── Sticky group: search + tabs + chips ── */}
      <div data-sticky-subheader className="sticky top-14 z-30 bg-white dark:bg-[#1E293B] shadow-sm">

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
          <div className="max-w-5xl mx-auto flex items-center gap-2 px-4 overflow-x-auto scrollbar-hide pb-2 pt-2">
            {ALL_TABS.map((tab) => {
              const count = tabCounts[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`chip flex-shrink-0 ${isActive ? "chip-active" : ""}`}
                >
                  <span>{TAB_ICONS[tab]}</span>
                  <span>{tabLabel(tab)}</span>
                  {count != null && count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${isActive ? "bg-white/25" : "bg-[#F1F5F9] dark:bg-slate-700 text-[#64748B] dark:text-slate-400"}`}>
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
            className="max-w-5xl mx-auto flex gap-2 overflow-x-auto scrollbar-hide px-4 pt-1 pb-2"
          >
            {["all", ...getCategoriesForTab(activeTab)].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategoryFilter(cat);
                  setTimeout(() => {
                    const el = listingsRef.current;
                    if (el) {
                      const top = el.getBoundingClientRect().top + window.scrollY - 130;
                      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
                    }
                  }, 50);
                }}
                className={`chip flex-shrink-0 ${categoryFilter === cat ? "chip-active" : ""}`}
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

      {/* ── Campus Market Discovery ─────────────────────────────────────────── */}
      {(loadingShops || featuredShops.length > 0 || recentShopListings.length > 0) && (
        <div className="max-w-5xl mx-auto px-4 mt-5">

          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-header">🏪 Campus Shops</h2>
            <Link
              href="/campus-market"
              className="flex items-center gap-0.5 text-xs font-semibold text-[#003366] dark:text-blue-400 hover:underline"
            >
              See all <ChevronRight size={13} />
            </Link>
          </div>

          {/* Horizontally scrollable shop pills */}
          {loadingShops ? (
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex flex-col items-center w-[80px] shrink-0 animate-pulse">
                  <div className="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-slate-700 mb-1.5" />
                  <div className="h-2.5 bg-gray-200 dark:bg-slate-700 rounded w-14" />
                </div>
              ))}
            </div>
          ) : featuredShops.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
              {featuredShops.map((shop) => (
                <ShopPillCard key={shop.id} shop={shop} />
              ))}
            </div>
          ) : null}

          {/* "New from Shops" listings carousel */}
          {recentShopListings.length > 0 && (() => {
            const SHOP_PAGE_SIZE = 6;
            const totalPages = Math.ceil(recentShopListings.length / SHOP_PAGE_SIZE);
            const pageListings = recentShopListings.slice(
              shopListingPage * SHOP_PAGE_SIZE,
              shopListingPage * SHOP_PAGE_SIZE + SHOP_PAGE_SIZE
            );
            return (
              <div className="mt-4 shop-picks-wrapper">
                <div className="flex items-center justify-between mb-2">
                  <p className="section-header text-sm">🛍️ Campus Market Picks</p>
                  <Link
                    href="/campus-market"
                    className="text-[11px] font-semibold text-[#003366] dark:text-blue-400 hover:underline"
                  >
                    Browse all →
                  </Link>
                </div>
                <div
                  className="overflow-hidden"
                  onTouchStart={(e) => { shopTouchStartX.current = e.touches[0].clientX; }}
                  onTouchEnd={(e) => {
                    if (shopTouchStartX.current === null) return;
                    const dx = e.changedTouches[0].clientX - shopTouchStartX.current;
                    shopTouchStartX.current = null;
                    if (Math.abs(dx) < 40) return;
                    const next = dx < 0
                      ? (shopListingPage + 1) % totalPages
                      : (shopListingPage - 1 + totalPages) % totalPages;
                    handleShopPageChange(next);
                  }}
                >
                  <div
                    key={shopListingPage}
                    className="grid grid-cols-3 sm:grid-cols-6 gap-2.5"
                    style={{ animation: "shopSlideIn 0.35s cubic-bezier(0.25,0.46,0.45,0.94) both" }}
                  >
                    {pageListings.map((listing) => (
                      <ShopListingMiniCard key={listing.id} listing={listing} />
                    ))}
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex justify-center gap-1.5 mt-3">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => handleShopPageChange(i)}
                        className={`rounded-full transition-all duration-300 ${
                          i === shopListingPage
                            ? "w-4 h-1.5 bg-[#003366] dark:bg-blue-400"
                            : "w-1.5 h-1.5 bg-gray-300 dark:bg-slate-600"
                        }`}
                        aria-label={`Page ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Divider before main listings */}
          <div className="border-t border-[#E2E8F0] dark:border-slate-700 mt-5" />
        </div>
      )}
      {/* ── End Campus Market Discovery ─────────────────────────────────────── */}

      {/* Listings grid */}
      <div ref={listingsRef} className="max-w-5xl mx-auto px-4 pt-4 pb-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-[#E2E8F0] dark:bg-slate-700" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500 whitespace-nowrap">👥 Student Listings</span>
          <div className="h-px flex-1 bg-[#E2E8F0] dark:bg-slate-700" />
        </div>
        {newItemsBuffer.length > 0 && (
          <button
            onClick={() => {
              setListings((prev) => {
                const existingIds = new Set(prev.map((l) => l.id));
                const fresh = newItemsBuffer.filter((l) => !existingIds.has(l.id));
                return [...fresh, ...prev];
              });
              setNewItemsBuffer([]);
            }}
            className="w-full text-center text-sm font-semibold text-white bg-[#003366] dark:bg-blue-600 py-2 rounded-xl mb-3"
          >
            ↑ {newItemsBuffer.length} new listing{newItemsBuffer.length > 1 ? "s" : ""} — tap to show
          </button>
        )}
        {loading ? (
          <SkeletonGrid />
        ) : displayedListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="text-5xl mb-4">{TAB_ICONS[activeTab]}</div>
            <p className="font-display font-bold text-gray-700 dark:text-slate-300 text-lg mb-1">
              Nothing here yet
            </p>
            <p className="text-sm text-gray-400 dark:text-slate-500">
              Be the first to post in this category!
            </p>
            {categoryFilter !== "all" ? (
              <button onClick={() => setCategoryFilter("all")} className="mt-4 text-[#003366] dark:text-blue-400 text-sm font-semibold underline">
                Show all categories
              </button>
            ) : (
              <Link href="/post" className="btn-primary mt-6 px-8">
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
                    className="btn-ghost flex items-center gap-2 px-8 min-h-[44px] disabled:opacity-50"
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

      {/* ===== ABOUT SECTION ===== */}
      <section className="mt-16 mb-8 px-4">
        {/* Divider */}
        <div className="border-t border-slate-200 dark:border-slate-700 mb-10" />

        {/* About card */}
        <div className="max-w-2xl mx-auto bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">

          {/* Header band — redesigned */}
          <div className="relative bg-[#003366] dark:bg-[#0A1F4E] overflow-hidden px-6 pt-7 pb-8">
            {/* Decorative geometry */}
            <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/[0.04] pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-white/[0.04] pointer-events-none" />
            <div className="absolute top-5 right-8 w-3 h-3 rounded-full bg-blue-300/30 pointer-events-none" />
            <div className="absolute bottom-6 right-24 w-1.5 h-1.5 rounded-full bg-blue-200/40 pointer-events-none" />
            <div className="absolute top-8 left-1/2 w-px h-20 bg-white/5 pointer-events-none" />

            {/* Verified badge */}
            <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-3 py-1 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_#4ade80]" />
              <span className="text-white/75 text-[9px] font-bold tracking-[0.12em] uppercase">Verified Student Platform · Free</span>
            </div>

            <h2 className="text-white text-[22px] font-bold tracking-tight leading-tight">
              XMUM Market
            </h2>
            <p className="text-blue-200/70 text-[13px] font-medium mt-1 leading-snug">
              The campus marketplace — built by students, for students.
            </p>
          </div>

          <div className="px-6 py-6 space-y-6">

            {/* Product description */}
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-bold text-[#003366] dark:text-blue-400 uppercase tracking-widest mb-2">What is XMUM Market?</p>
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                  A free, student-built platform for campus life.
                </p>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                  Whether you're moving out of your dorm, looking for affordable textbooks, or offering tutoring services — this is the place to connect with fellow XMUM students.
                </p>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                  Every account is verified with an <span className="text-[#003366] dark:text-blue-400">@xmu.edu.my</span> email address.
                </p>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                  No strangers, no scammers — just your campus community.
                </p>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                  Buy &amp; sell, find lost items, hire for jobs, rent vehicles, browse Campus Market shops.
                </p>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                  Everything happens right here, in English or Chinese (中文).
                </p>
              </div>
            </div>

            {/* Feature highlights */}
            <div>
              <h3 className="text-sm font-semibold text-[#003366] dark:text-blue-400 uppercase tracking-wide mb-3">Key Features</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  ["🛍️", "Buy & Sell", "Second-hand items across 7 categories"],
                  ["🔍", "Lost & Found", "Report or claim lost items on campus"],
                  ["💼", "Jobs & Services", "Tutoring, design, dev, and more"],
                  ["🤝", "Peer Assistance", "Request help from fellow students"],
                  ["🚗", "Rentals", "Rent cars, motorcycles & e-bikes"],
                  ["🔒", "XMUM-Only Access", "Verified student email required"],
                ].map(([icon, title, desc]) => (
                  <li key={title} className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5">
                    <span className="text-lg mt-0.5">{icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Creator info */}
            <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
              <h3 className="text-sm font-semibold text-[#003366] dark:text-blue-400 uppercase tracking-wide mb-3">Created By</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#003366] dark:bg-blue-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  SK
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">SK Tanvir Ahmed Anik</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Student ID: cys2209204 · XMUM</p>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
              <h3 className="text-sm font-semibold text-[#003366] dark:text-blue-400 uppercase tracking-wide mb-3">Contact Admin</h3>
              <div className="space-y-2.5">

                {/* Email */}
                <a
                  href="mailto:cys2209204@xmu.edu.my"
                  className="flex items-center gap-3 group bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl px-4 py-3 transition-colors"
                >
                  <span className="text-xl">📧</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Email</p>
                    <p className="text-sm font-medium text-[#003366] dark:text-blue-400 group-hover:underline truncate">
                      cys2209204@xmu.edu.my
                    </p>
                  </div>
                  <span className="text-slate-400 text-xs">→</span>
                </a>

                {/* WhatsApp */}
                <a
                  href="https://wa.me/60142246554"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 group bg-slate-50 dark:bg-slate-800 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl px-4 py-3 transition-colors"
                >
                  <span className="text-xl">💬</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">WhatsApp</p>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400 group-hover:underline">
                      +60 14-224 6554
                    </p>
                  </div>
                  <span className="text-slate-400 text-xs">→</span>
                </a>
              </div>
            </div>

            {/* Footer note */}
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2">
              XMUM Market is a student project. For official university matters, contact XMUM administration directly.
            </p>

          </div>
        </div>
      </section>
      {/* ===== END ABOUT SECTION ===== */}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
