import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { Link, useLocation } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getListingsPage, getTabCounts } from "@/lib/listings";
import { getActiveAds } from "@/lib/ads";
import { Listing, ListingType, SponsoredAd } from "@/lib/types";
import { QueryDocumentSnapshot } from "firebase/firestore";
import SponsoredAdCard from "@/components/SponsoredAdCard";
import AuthModal from "@/components/AuthModal";
import { Search, ChevronDown, MapPin, Clock, Loader2, SlidersHorizontal, Bookmark, BookmarkCheck, CheckCircle2, Eye, Wifi } from "lucide-react";
import { saveListing, unsaveListing, isListingSaved } from "@/lib/savedListings";

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

const TYPE_BORDER_COLOR: Record<string, string> = {
  "buy-sell":   "#003366",
  "lost-found": "#0D9488",
  "jobs":       "#7C3AED",
  "assistance": "#EA580C",
  "rental":     "#D97706",
};

const VEHICLE_ICONS: Record<string, string> = {
  car: "🚗", bike: "🏍️", motorcycle: "🏍️", scooter: "🛵", bicycle: "🚲",
};

const ALL_TABS: ListingType[] = ["buy-sell", "lost-found", "jobs", "assistance", "rental"];

const BROWSE_CATEGORIES = [
  { icon: "💻", name: "Electronics", tab: "buy-sell" as ListingType, cat: "electronics" },
  { icon: "📚", name: "Books & Notes", tab: "buy-sell" as ListingType, cat: "books" },
  { icon: "👕", name: "Clothing", tab: "buy-sell" as ListingType, cat: "clothing" },
  { icon: "🪑", name: "Furniture", tab: "buy-sell" as ListingType, cat: "furniture" },
  { icon: "🍜", name: "Food & Drinks", tab: "buy-sell" as ListingType, cat: "food" },
  { icon: "🛠️", name: "Services", tab: "buy-sell" as ListingType, cat: "services" },
  { icon: "🔍", name: "Lost & Found", tab: "lost-found" as ListingType, cat: "all" },
  { icon: "💼", name: "Jobs", tab: "jobs" as ListingType, cat: "all" },
  { icon: "🤝", name: "Assistance", tab: "assistance" as ListingType, cat: "all" },
  { icon: "🚗", name: "Rentals", tab: "rental" as ListingType, cat: "all" },
];

function getCategoriesForTab(tab: ListingType): string[] {
  if (tab === "buy-sell") return BUY_SELL_CATEGORIES;
  if (tab === "lost-found") return LOST_FOUND_CATEGORIES;
  if (tab === "jobs") return JOBS_CATEGORIES;
  if (tab === "rental") return RENTAL_VEHICLE_TYPES;
  return ASSISTANCE_CATEGORIES;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function fmtRM(n: number) {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface ListingRowProps {
  listing: Listing;
}

function ListingRow({ listing }: ListingRowProps) {
  const { t } = useLang();
  const { user } = useAuth();
  const isSold = listing.status === "sold";
  const isOwnListing = !!user && user.uid === listing.userId;
  const isRental = listing.type === "rental";
  const isJobs = listing.type === "jobs";
  const isAssistance = listing.type === "assistance";
  const borderColor = TYPE_BORDER_COLOR[listing.type] ?? "#003366";

  const [isSaved, setIsSaved] = useState(false);
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!user || isOwnListing) return;
    isListingSaved(user.uid, listing.id).then(setIsSaved).catch(() => {});
  }, [user?.uid, listing.id, isOwnListing]);

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { setShowAuthModal(true); return; }
    if (isOwnListing || savingInProgress) return;
    setSavingInProgress(true);
    try {
      if (isSaved) { await unsaveListing(user.uid, listing.id); setIsSaved(false); }
      else { await saveListing(user.uid, listing); setIsSaved(true); }
    } catch { /* silent */ } finally { setSavingInProgress(false); }
  };

  const priceDisplay = () => {
    if (listing.type === "buy-sell") {
      if (!listing.price || listing.price === 0) return t.free;
      return `RM ${fmtRM(listing.price)}`;
    }
    if (isJobs && listing.price && listing.price > 0) return `RM ${fmtRM(listing.price)}/hr`;
    if (isAssistance && listing.price != null) return `RM ${fmtRM(listing.price)}`;
    if (isRental && listing.rentalPricePerDay != null) return `RM ${fmtRM(listing.rentalPricePerDay)}/day`;
    if (listing.type === "lost-found") return listing.category === "lostItem" ? "Lost" : "Found";
    return null;
  };

  const conditionBadge = () => {
    if (listing.type === "buy-sell") return listing.condition === "new" ? t.conditionNew : t.conditionUsed;
    if (isJobs) return listing.jobSubtype === "offering" ? "Offering" : "Seeking";
    if (listing.type === "lost-found") return listing.category === "lostItem" ? "Lost" : "Found";
    if (isAssistance) return "Help Wanted";
    if (isRental) return listing.vehicleType ? `${VEHICLE_ICONS[listing.vehicleType]} For Rent` : "For Rent";
    return null;
  };

  return (
    <>
      <Link href={`/listing/${listing.id}`}>
        <div
          className={`flex gap-3 p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer border-l-4 ${isSold ? "opacity-60" : ""}`}
          style={{ borderLeftColor: borderColor }}
        >
          {/* Thumbnail */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-700 relative">
            {listing.photos.length > 0 ? (
              <img
                src={listing.photos[0]}
                alt={listing.title}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600">
                {isRental && listing.vehicleType ? VEHICLE_ICONS[listing.vehicleType] : CATEGORY_ICONS[listing.category] ?? "📦"}
              </div>
            )}
            {isSold && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-[10px] font-black tracking-widest uppercase">
                  {listing.type === "lost-found" ? "Resolved" : "Sold"}
                </span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col flex-1 min-w-0 py-0.5">
            <h3 className="font-semibold text-sm sm:text-base text-[#0F172A] dark:text-slate-100 line-clamp-2 leading-snug">
              {listing.title}
            </h3>

            {/* Price */}
            {priceDisplay() && (
              <p className={`mt-1 font-bold text-base sm:text-lg ${isSold ? "text-gray-400 line-through" : "text-[#003366] dark:text-blue-400"}`}>
                {priceDisplay()}
              </p>
            )}

            {/* Remote badge for jobs */}
            {isJobs && listing.isRemote && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 w-fit">
                <Wifi size={9} /> Remote
              </span>
            )}

            {/* Meta row */}
            <div className="mt-auto pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
              {conditionBadge() && (
                <span className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-2 py-0.5 rounded font-medium">
                  {conditionBadge()}
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin size={11} />
                {listing.meetupSpot ?? "XMUM Campus"}
              </span>
              <span className="flex items-center gap-1">
                by @{listing.userName}
              </span>
              {typeof listing.viewCount === "number" && listing.viewCount > 0 && (
                <span className="hidden sm:flex items-center gap-1">
                  <Eye size={11} /> {listing.viewCount}
                </span>
              )}
              <span className="flex items-center gap-1 ml-auto shrink-0">
                <Clock size={11} />
                {relativeTime(listing.createdAt)}
              </span>
            </div>
          </div>

          {/* Save button */}
          {!isOwnListing && (
            <button
              onClick={handleSaveToggle}
              disabled={savingInProgress}
              className="shrink-0 self-start p-2 text-gray-400 hover:text-[#003366] dark:hover:text-blue-400 transition-colors disabled:opacity-40"
              aria-label={isSaved ? "Remove from saved" : "Save listing"}
            >
              {isSaved
                ? <BookmarkCheck size={18} className="text-[#003366] dark:text-blue-400" />
                : <Bookmark size={18} />
              }
            </button>
          )}
        </div>
      </Link>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  );
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
  const [sortOrder, setSortOrder] = useState<"recent" | "price_asc" | "price_desc">("recent");

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

  useEffect(() => { getActiveAds(2).then(setAds); }, []);
  useEffect(() => { getTabCounts().then(setTabCounts).catch(() => {}); }, []);

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
    setCategoryFilter("all");
    const el = chipRowRef.current;
    if (el) { el.scrollLeft = 0; setShowLeftShadow(false); setShowRightShadow(el.scrollWidth > el.clientWidth); }
  };

  const handleCategoryTile = (tab: ListingType, cat: string) => {
    if (activeTab !== tab) { setActiveTab(tab); setCategoryFilter(cat); }
    else { setCategoryFilter(cat); }
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
    if (e.key === "Enter" && searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    else navigate("/search");
  };

  const displayedListings = categoryFilter === "all"
    ? listings
    : listings.filter((l) => l.category === categoryFilter);

  const sortedListings = [...displayedListings].sort((a, b) => {
    if (sortOrder === "price_asc") return (a.price ?? 0) - (b.price ?? 0);
    if (sortOrder === "price_desc") return (b.price ?? 0) - (a.price ?? 0);
    return b.createdAt - a.createdAt;
  });

  const SkeletonRow = () => (
    <div className="flex gap-3 p-4 border-l-4 border-gray-200 dark:border-slate-700 animate-pulse">
      <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-lg bg-gray-200 dark:bg-slate-700" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-4/5" />
        <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded w-1/3" />
        <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-2/3 mt-4" />
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-200 bg-gray-50 dark:bg-slate-900 min-h-screen">

      {/* ── Hero Search Bar (mudah.my style) ── */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 py-4 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
            {user && userProfile
              ? `${lang === "en" ? "Good day" : "你好"}, ${userProfile.displayName} 👋 · Student-only marketplace`
              : "Student-only marketplace · @xmu.edu.my"
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKey}
                placeholder={lang === "en" ? "What are you looking for?" : "搜索商品、服务..."}
                className="w-full pl-10 pr-4 py-3 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#003366]/30 dark:focus:ring-blue-500/30 focus:border-[#003366] dark:focus:border-blue-500 transition-all"
              />
            </div>
            {/* Category select */}
            <div className="relative hidden sm:block w-44">
              <select
                className="w-full appearance-none bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-3 pr-9 text-sm text-gray-700 dark:text-slate-200 focus:outline-none focus:border-[#003366] dark:focus:border-blue-500 cursor-pointer"
                onChange={(e) => { if (e.target.value !== "all") navigate(`/search?q=&cat=${e.target.value}`); }}
              >
                <option value="all">{lang === "en" ? "All Categories" : "所有分类"}</option>
                <option value="buy-sell">{t.buySell}</option>
                <option value="lost-found">{t.lostFound}</option>
                <option value="jobs">{t.jobs}</option>
                <option value="assistance">{t.assistance}</option>
                <option value="rental">{t.rental ?? "Rentals"}</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={15} />
            </div>
            {/* Search button */}
            <button
              onClick={handleSearchSubmit}
              className="flex items-center justify-center gap-2 bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-colors sm:w-auto w-full"
            >
              <Search size={17} />
              {lang === "en" ? "Search" : "搜索"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Browse Categories grid ── */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-3 uppercase tracking-wide">
            {lang === "en" ? "Browse Categories" : "浏览分类"}
          </h2>
          <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-10 gap-2">
            {BROWSE_CATEGORIES.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleCategoryTile(item.tab, item.cat)}
                className="flex flex-col items-center justify-center gap-1.5 p-2 sm:p-3 rounded-xl border border-gray-100 dark:border-slate-700 hover:border-[#003366] dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
              >
                <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform">{item.icon}</span>
                <span className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-slate-400 text-center leading-tight">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sticky group: tabs + chips ── */}
      <div data-sticky-subheader className="sticky top-14 sm:top-16 z-30 bg-white dark:bg-slate-800 shadow-sm">

        {/* Tab bar */}
        <div className="border-b border-gray-200 dark:border-slate-700">
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
                      : "border-transparent text-gray-500 dark:text-slate-500 hover:text-gray-800 dark:hover:text-slate-300"
                    }
                  `}
                >
                  <span className="text-base leading-none">{TAB_ICONS[tab]}</span>
                  <span>{tabLabel(tab)}</span>
                  {count != null && count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${isActive ? "bg-[#003366] dark:bg-blue-500 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400"}`}>
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category chips */}
        <div className="relative border-b border-gray-100 dark:border-slate-700">
          {showLeftShadow && (
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-r from-white dark:from-slate-800 to-transparent" />
          )}
          {showRightShadow && (
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-l from-white dark:from-slate-800 to-transparent" />
          )}
          <div ref={chipRowRef} className="max-w-5xl mx-auto flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2">
            {["all", ...getCategoriesForTab(activeTab)].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`
                  flex-shrink-0 px-3.5 py-1.5 whitespace-nowrap rounded-full text-xs font-medium
                  border transition-all duration-150
                  ${categoryFilter === cat
                    ? "bg-[#003366] text-white border-[#003366] dark:bg-blue-600 dark:border-blue-600"
                    : "bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-[#003366] hover:text-[#003366] dark:hover:border-blue-400"
                  }
                `}
              >
                <span className="mr-1">{CATEGORY_ICONS[cat] ?? "📦"}</span>
                {cat === "all" ? (lang === "en" ? "All" : "全部") : t.categories[cat as keyof typeof t.categories]}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* ── End sticky group ── */}

      {/* ── Main content: listings + sidebar ── */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-5 items-start">

          {/* Left: listings feed */}
          <div className="flex-1 min-w-0">

            {/* Signup nudge */}
            {!user && (
              <div className="mb-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-blue-700 dark:text-blue-300">🎓 Exclusive to XMUM students</span>
                <button onClick={() => setShowAuth(true)} className="text-sm font-semibold text-blue-600 dark:text-blue-400 underline">
                  Sign up free
                </button>
              </div>
            )}

            {/* Count + sort bar */}
            {!loading && sortedListings.length > 0 && (
              <div className="flex items-center justify-between mb-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5">
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  <strong className="text-gray-800 dark:text-slate-200">{sortedListings.length}</strong>
                  {hasMore && "+"} {sortedListings.length === 1 ? "listing" : "listings"}
                  {categoryFilter !== "all" && ` · ${t.categories[categoryFilter as keyof typeof t.categories] ?? categoryFilter}`}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wide hidden sm:block">Sort</span>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                    className="text-xs border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-[#003366] dark:focus:border-blue-500"
                  >
                    <option value="recent">Recent First</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>
                  <SlidersHorizontal size={14} className="text-gray-400 dark:text-slate-500" />
                </div>
              </div>
            )}

            {/* Listing rows */}
            {loading ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden divide-y divide-gray-100 dark:divide-slate-700">
                {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : sortedListings.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col items-center py-16 text-center px-4">
                <span className="text-5xl mb-4">{TAB_ICONS[activeTab]}</span>
                <p className="text-base font-semibold text-gray-700 dark:text-slate-300">No listings yet</p>
                <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Be the first to post something!</p>
                {categoryFilter !== "all" ? (
                  <button onClick={() => setCategoryFilter("all")} className="mt-4 text-[#003366] dark:text-blue-400 text-sm font-semibold underline">
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
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden divide-y divide-gray-100 dark:divide-slate-700/60 shadow-sm">
                  {sortedListings.map((listing, i) => (
                    <Fragment key={listing.id}>
                      <ListingRow listing={listing} />
                      {/* Inline sponsored ad every 6 items */}
                      {(i + 1) % 6 === 0 && ads[1] && (
                        <div className="px-4 py-3 bg-amber-50/30 dark:bg-amber-900/10">
                          <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">Sponsored</p>
                          <SponsoredAdCard ad={ads[1]} />
                        </div>
                      )}
                    </Fragment>
                  ))}
                </div>

                {/* Load more */}
                {categoryFilter === "all" && (
                  <div className="mt-4 flex justify-center">
                    {hasMore ? (
                      <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="flex items-center gap-2 px-6 py-3 w-full bg-white dark:bg-slate-800 text-[#003366] dark:text-blue-400 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-semibold hover:border-[#003366] dark:hover:border-blue-500 disabled:opacity-50 transition-all justify-center"
                      >
                        {loadingMore ? <><Loader2 size={15} className="animate-spin" /> {t.loading}</> : t.loadMore}
                      </button>
                    ) : listings.length > 0 ? (
                      <p className="text-xs text-gray-400 dark:text-slate-500 py-2">{t.noMoreListings}</p>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right sidebar — desktop only */}
          <div className="hidden lg:flex flex-col gap-4 w-64 shrink-0">
            {ads.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">Sponsored</p>
                <SponsoredAdCard ad={ads[0]} />
              </div>
            )}

            {/* Quick links card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <h3 className="text-xs font-bold text-gray-600 dark:text-slate-400 uppercase tracking-wide mb-3">Quick Links</h3>
              <div className="space-y-2">
                <Link href="/post" className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 hover:text-[#003366] dark:hover:text-blue-400 transition-colors">
                  <span>📝</span> Post a listing
                </Link>
                <Link href="/search" className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 hover:text-[#003366] dark:hover:text-blue-400 transition-colors">
                  <span>🔍</span> Advanced search
                </Link>
                <Link href="/campus-market" className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 hover:text-[#003366] dark:hover:text-blue-400 transition-colors">
                  <span>🏪</span> Campus Market
                </Link>
                {!user && (
                  <button onClick={() => setShowAuth(true)} className="flex items-center gap-2 text-sm text-[#003366] dark:text-blue-400 font-semibold hover:underline w-full text-left">
                    <span>🎓</span> Sign up with XMUM email
                  </button>
                )}
              </div>
            </div>

            {/* Second ad slot */}
            {ads.length > 1 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">Sponsored</p>
                <SponsoredAdCard ad={ads[1]} />
              </div>
            )}
          </div>

        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
