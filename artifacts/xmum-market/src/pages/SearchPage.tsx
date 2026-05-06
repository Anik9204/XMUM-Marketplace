import { useState, useEffect, useRef } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { searchListings } from "@/lib/listings";
import { Listing, ListingType } from "@/lib/types";
import ListingCard from "@/components/ListingCard";
import { Search, SlidersHorizontal, X } from "lucide-react";

export default function SearchPage() {
  const { t } = useLang();
  const [type, setType] = useState<ListingType>("buy-sell");
  const [keyword, setKeyword] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [condition, setCondition] = useState("all");
  const [results, setResults] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(doSearch, 400);
    return () => clearTimeout(debounceRef.current);
  }, [keyword, type, minPrice, maxPrice, condition]);

  const clearFilters = () => {
    setMinPrice("");
    setMaxPrice("");
    setCondition("all");
  };

  const hasFilters = minPrice || maxPrice || condition !== "all";

  return (
    <div className="max-w-5xl mx-auto">
      {/* Search header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-14 z-30">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366]"
              autoFocus
            />
            {keyword && (
              <button onClick={() => setKeyword("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative p-2.5 rounded-xl border transition-colors ${showFilters || hasFilters ? "bg-[#003366] border-[#003366] text-white" : "border-gray-200 text-gray-500"}`}
          >
            <SlidersHorizontal size={18} />
            {hasFilters && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center">
                !
              </span>
            )}
          </button>
        </div>

        {/* Type tabs */}
        <div className="flex gap-1 mt-2.5">
          {(["buy-sell", "lost-found"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setType(tab)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${type === tab ? "bg-[#003366] text-white" : "bg-gray-100 text-gray-500"}`}
            >
              {tab === "buy-sell" ? t.buySell : t.lostFound}
            </button>
          ))}
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
            {type === "buy-sell" && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">{t.filterPrice}</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder={t.minPrice}
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    min={0}
                    className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#003366]"
                  />
                  <span className="text-gray-400 self-center">—</span>
                  <input
                    type="number"
                    placeholder={t.maxPrice}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    min={0}
                    className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#003366]"
                  />
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">{t.filterCondition}</p>
              <div className="flex gap-2">
                {["all", "new", "used"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCondition(c)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${condition === c ? "bg-[#003366] text-white" : "bg-white border border-gray-200 text-gray-600"}`}
                  >
                    {c === "all" ? t.allConditions : c === "new" ? t.conditionNew : t.conditionUsed}
                  </button>
                ))}
              </div>
            </div>

            {hasFilters && (
              <button onClick={clearFilters} className="w-full text-xs text-red-500 border border-red-200 rounded-lg py-1.5 hover:bg-red-50 transition-colors">
                {t.clearFilters}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-44 bg-gray-100" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-2 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : searched && results.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Search size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">{t.noResults}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {results.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
