import { useState, useEffect, useRef, useCallback } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { searchListings } from "@/lib/listings";
import { Listing, ListingType } from "@/lib/types";
import ListingCard from "@/components/ListingCard";
import { Search, SlidersHorizontal, X } from "lucide-react";

const inputCls =
  "w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-2xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#003366]/30 dark:focus:ring-blue-400/30 focus:border-[#003366] dark:focus:border-blue-400 transition shadow-sm";

const ALL_TABS: { value: ListingType; label: (t: any) => string }[] = [
  { value: "buy-sell", label: (t) => t.buySell },
  { value: "lost-found", label: (t) => t.lostFound },
  { value: "jobs", label: (t) => t.jobs },
  { value: "assistance", label: (t) => t.assistance },
  { value: "rental", label: (t) => t.rental },
];

type PriceRange = "all" | "under50" | "50-200" | "200-500" | "500plus";

const PRICE_RANGE_PILLS: { value: PriceRange; label: string; min?: number; max?: number }[] = [
  { value: "all",      label: "All Prices" },
  { value: "under50",  label: "Under RM50",  max: 50 },
  { value: "50-200",   label: "RM50–200",    min: 50,  max: 200 },
  { value: "200-500",  label: "RM200–500",   min: 200, max: 500 },
  { value: "500plus",  label: "RM500+",      min: 500 },
];

export default function SearchPage() {
  const { t } = useLang();

  const [type, setType] = useState<ListingType>("buy-sell");
  const [keyword, setKeyword] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") ?? "";
  });
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [condition, setCondition] = useState("all");
  const [results, setResults] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searched, setSearched] = useState(false);
  const [priceRange, setPriceRange] = useState<PriceRange>("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const skipNextDebounceRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Only auto-focus on desktop — not on mobile (avoids keyboard pop-up)
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (!isMobile && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, []);

  const showPriceFilter = type === "buy-sell" || type === "jobs" || type === "assistance" || type === "rental";
  const showConditionFilter = type === "buy-sell";

  // Bug 1 fix: auto-run search immediately when arriving from home page with ?q=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q && q.trim()) {
      skipNextDebounceRef.current = true;
      setLoading(true);
      setSearched(true);
      searchListings(type, q, undefined, undefined, "all")
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPriceRange = (range: PriceRange) => {
    setPriceRange(range);
    const pill = PRICE_RANGE_PILLS.find((p) => p.value === range);
    if (!pill) return;
    setMinPrice(pill.min != null ? String(pill.min) : "");
    setMaxPrice(pill.max != null ? String(pill.max) : "");
  };

  const doSearch = async () => {
    const hasActiveFilter = !!minPrice || !!maxPrice || (condition !== "all");
    if (!keyword.trim() && !searched && !hasActiveFilter) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchListings(
        type,
        keyword,
        minPrice ? parseFloat(minPrice) : undefined,
        maxPrice ? parseFloat(maxPrice) : undefined,
        condition
      );
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Bug 2 fix: debounce auto-search watching priceRange (not raw min/max) + proper guard
  useEffect(() => {
    // Skip the first debounce trigger if the mount auto-search already handled it
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      return;
    }
    const hasActiveFilter = !!minPrice || !!maxPrice || (condition !== "all");
    if (!keyword.trim() && !searched && !hasActiveFilter) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch();
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [keyword, type, priceRange, condition]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep priceRange pill in sync when manual min/max inputs change
  useEffect(() => {
    const matched = PRICE_RANGE_PILLS.find(
      (p) =>
        (p.min != null ? String(p.min) : "") === minPrice &&
        (p.max != null ? String(p.max) : "") === maxPrice
    );
    setPriceRange(matched?.value ?? "all");
  }, [minPrice, maxPrice]);

  const clearFilters = () => {
    setMinPrice("");
    setMaxPrice("");
    setCondition("all");
    setPriceRange("all");
  };

  // Bug 3 fix: reset all filters when switching listing types
  const handleTypeChange = (newType: ListingType) => {
    setType(newType);
    setPriceRange("all");
    setMinPrice("");
    setMaxPrice("");
    setCondition("all");
    setResults([]);
    setSearched(false);
  };

  const hasFilters = minPrice || maxPrice || condition !== "all";

  type FilterKey = "minPrice" | "maxPrice" | "condition";

  const activeFilterPills: { key: FilterKey; label: string }[] = [];
  if (minPrice) activeFilterPills.push({ key: "minPrice", label: `Min RM ${minPrice}` });
  if (maxPrice) activeFilterPills.push({ key: "maxPrice", label: `Max RM ${maxPrice}` });
  if (condition !== "all") activeFilterPills.push({ key: "condition", label: condition === "new" ? t.conditionNew : t.conditionUsed });

  const clearFilter = (key: FilterKey) => {
    if (key === "minPrice") setMinPrice("");
    else if (key === "maxPrice") setMaxPrice("");
    else if (key === "condition") setCondition("all");
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-200">
      {/* Search header */}
      <div data-sticky-subheader className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700 px-4 py-3 sticky top-14 z-30">
        {/* Search input row */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-2xl pl-9 pr-9 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#003366]/30 dark:focus:ring-blue-400/30 focus:border-[#003366] dark:focus:border-blue-400 transition shadow-sm"
            />
            {keyword && (
              <button onClick={() => setKeyword("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl border transition-colors ${showFilters || hasFilters ? "bg-[#003366] dark:bg-blue-600 border-[#003366] dark:border-blue-600 text-white" : "border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 dark:bg-slate-700"}`}
          >
            <SlidersHorizontal size={16} />
            <span className="text-xs font-medium hidden sm:inline">Filters</span>
            {hasFilters && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Price range quick filter — shown when price filter is relevant */}
        {showPriceFilter && (
          <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide pb-0.5">
            {PRICE_RANGE_PILLS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => applyPriceRange(value)}
                className={`chip flex-shrink-0 ${priceRange === value ? "chip-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Active filter pills */}
        {activeFilterPills.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 mb-1">
            {activeFilterPills.map(({ key, label }) => (
              <span key={key} className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full px-3 py-1 text-xs font-medium min-h-[32px]">
                {label}
                <button onClick={() => clearFilter(key)} className="ml-1 hover:text-red-500">×</button>
              </span>
            ))}
          </div>
        )}

        {/* Type tabs — Bug 3 fix: use handleTypeChange to reset filters */}
        <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide pb-0.5">
          {ALL_TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleTypeChange(value)}
              className={`chip flex-shrink-0 ${type === value ? "chip-active" : ""}`}
            >
              {label(t)}
            </button>
          ))}
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 space-y-3">
            {showPriceFilter && (
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-slate-300 mb-1.5">{t.filterPrice}</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    placeholder={t.minPrice}
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    min={0}
                    className={inputCls}
                  />
                  <span className="text-gray-400 dark:text-slate-500 shrink-0">—</span>
                  <input
                    type="number"
                    placeholder={t.maxPrice}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    min={0}
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {showConditionFilter && (
              <div>
                <p className="text-xs font-display font-medium text-gray-600 dark:text-slate-300 mb-1.5">{t.filterCondition}</p>
                <div className="flex gap-2">
                  {["all", "new", "used"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCondition(c)}
                      className={`chip flex-1 ${condition === c ? "chip-active" : ""}`}
                    >
                      {c === "all" ? t.allConditions : c === "new" ? t.conditionNew : t.conditionUsed}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bug 4 fix: Apply + Reset buttons replacing the single clear link */}
            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
              <button
                onClick={() => {
                  setPriceRange("all");
                  setMinPrice("");
                  setMaxPrice("");
                  setCondition("all");
                }}
                className="flex-1 min-h-[44px] text-sm text-gray-600 dark:text-slate-300
                           border border-gray-300 dark:border-slate-600 rounded-xl
                           hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              >
                Reset
              </button>
              <button
                onClick={() => { setShowFilters(false); doSearch(); }}
                className="btn-primary flex-1 min-h-[44px]"
              >
                {t.applyFilters}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-gray-100 dark:bg-slate-700" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !searched ? (
          <div className="py-8">
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-3">
              Popular Categories
            </p>
            <div className="flex flex-wrap gap-2">
              {["electronics", "books", "clothing", "furniture", "food"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    const label = t.categories[cat as keyof typeof t.categories] ?? cat;
                    setKeyword(label);
                    setSearched(true);
                    setLoading(true);
                    searchListings(type, label, undefined, undefined, "all")
                      .then(setResults)
                      .catch(() => setResults([]))
                      .finally(() => setLoading(false));
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-xs font-medium text-gray-700 dark:text-slate-300 hover:border-[#003366] dark:hover:border-blue-400 transition-colors shadow-sm"
                >
                  {({"electronics":"💻","books":"📚","clothing":"👕","furniture":"🪑","food":"🍳"} as Record<string, string>)[cat]}
                  {" "}{t.categories[cat as keyof typeof t.categories]}
                </button>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="col-span-full flex flex-col items-center py-16 text-center">
            <span className="text-5xl mb-4">🔍</span>
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
              No results{keyword ? ` for "${keyword}"` : ""}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Try different keywords or browse by category
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </p>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((listing) => (
                <ListingCard key={listing.id} listing={listing} showSaveButton />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
