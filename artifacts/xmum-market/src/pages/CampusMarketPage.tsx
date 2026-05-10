import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAllShops, getAllShopListings, getShopListingsByCategory, getApprovedShopAds,
} from "@/lib/shops";
import { Shop, ShopListing, ShopAd, ShopCategory } from "@/lib/types";
import { Store, ChevronRight, Package, Star, Plus } from "lucide-react";

const SHOP_CATEGORIES: ShopCategory[] = [
  "Food & Beverage", "Tutoring & Education", "Fashion & Apparel", "Electronics",
  "Beauty & Wellness", "Transport & Rental", "Handmade & Custom", "Books & Stationery",
  "Services", "Travel & Lifestyle", "Others",
];

const PAGE_SIZE = 12;

function StarRow({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-gray-200 dark:text-slate-600"}
        />
      ))}
    </div>
  );
}

function PriceTag({ listing }: { listing: ShopListing }) {
  if (listing.pricingModel === "negotiable")
    return <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Negotiable</span>;
  if (listing.price === undefined) return null;
  const suffix =
    listing.pricingModel && listing.pricingModel !== "fixed"
      ? `/${listing.pricingModel.replace("_", " ")}`
      : "";
  return (
    <span className="text-xs font-bold text-[#003366] dark:text-blue-300">
      RM {listing.price.toFixed(2)}{suffix}
    </span>
  );
}

// ── Hero banner ───────────────────────────────────────────────────────────────
function HeroBanner({ ads }: { ads: ShopAd[] }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (ads.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % ads.length), 5000);
    return () => clearInterval(id);
  }, [ads.length]);

  if (ads.length === 0) {
    return (
      <div
        className="relative rounded-2xl overflow-hidden mx-4 mb-4"
        style={{ background: "linear-gradient(135deg, #003366 0%, #0066cc 60%, #0099ff 100%)" }}
      >
        <div className="px-6 py-8 sm:py-10">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Campus Market</p>
          <h1 className="text-white text-2xl sm:text-3xl font-black leading-tight mb-2">
            Shop from fellow<br />XMUM students
          </h1>
          <p className="text-white/70 text-sm mb-4">Discover food, services, and more — right on campus.</p>
          <Link href="/create-shop">
            <button className="bg-white text-[#003366] text-xs font-bold px-4 py-2 rounded-xl hover:bg-gray-100 transition">
              Open Your Shop →
            </button>
          </Link>
        </div>
        <div className="absolute right-4 bottom-0 opacity-10 text-[120px] leading-none select-none pointer-events-none">🛍️</div>
      </div>
    );
  }

  const ad = ads[idx];
  return (
    <div className="relative mx-4 mb-4 rounded-2xl overflow-hidden">
      <a href={ad.ctaUrl} target="_blank" rel="noopener noreferrer" className="block">
        {ad.imageUrl ? (
          <img src={ad.imageUrl} alt={ad.tagline} className="w-full h-40 sm:h-52 object-cover" />
        ) : (
          <div className="w-full h-40 sm:h-52 bg-gradient-to-r from-[#003366] to-blue-500 flex items-center justify-center">
            <span className="text-white text-4xl font-black">{ad.tagline}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-4">
          <p className="text-white font-bold text-base">{ad.tagline}</p>
          <span className="inline-block mt-1 bg-white text-[#003366] text-xs font-bold px-3 py-1 rounded-full w-fit">
            {ad.ctaLabel}
          </span>
        </div>
      </a>
      {ads.length > 1 && (
        <div className="absolute bottom-2 right-3 flex gap-1">
          {ads.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-white w-3" : "bg-white/50"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shop card ─────────────────────────────────────────────────────────────────
function ShopCard({ shop }: { shop: Shop }) {
  return (
    <Link href={`/shop/${shop.slug}`}>
      <div className="flex flex-col items-center w-[100px] shrink-0 cursor-pointer group">
        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm group-hover:shadow-md transition-shadow flex items-center justify-center mb-2">
          {shop.logoUrl ? (
            <img src={shop.logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Store size={28} className="text-[#003366] dark:text-blue-400" />
          )}
        </div>
        <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 text-center line-clamp-1 w-full">{shop.name}</p>
        <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center truncate w-full">{shop.category}</p>
        {shop.reviewCount > 0 && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <StarRow rating={shop.rating} size={10} />
            <span className="text-[9px] text-gray-400 dark:text-slate-500">{shop.rating.toFixed(1)}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Listing card ──────────────────────────────────────────────────────────────
function ListingCard({ listing }: { listing: ShopListing }) {
  return (
    <Link href={`/shop/${listing.shopSlug}`}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98] cursor-pointer">
        {listing.photos[0] ? (
          <img src={listing.photos[0]} alt="" className="w-full aspect-square object-cover" />
        ) : (
          <div className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
            <Package size={32} className="text-gray-300 dark:text-slate-500" />
          </div>
        )}
        <div className="p-3">
          <p className="text-xs font-semibold text-gray-900 dark:text-slate-100 line-clamp-2 mb-1">{listing.title}</p>
          <PriceTag listing={listing} />
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 truncate">{listing.shopName}</p>
        </div>
      </div>
    </Link>
  );
}

// ── Skeleton cards ────────────────────────────────────────────────────────────
function ListingSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700 animate-pulse">
      <div className="aspect-square bg-gray-100 dark:bg-slate-700" />
      <div className="p-3 space-y-2">
        <div className="h-2.5 bg-gray-100 dark:bg-slate-700 rounded w-4/5" />
        <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded w-1/2" />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CampusMarketPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [ads, setAds] = useState<ShopAd[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [listings, setListings] = useState<ShopListing[]>([]);
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);
  const [selectedCategory, setSelectedCategory] = useState<ShopCategory | "All">("All");
  const [loadingShops, setLoadingShops] = useState(true);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Initial data load
  useEffect(() => {
    getApprovedShopAds().then(setAds).catch(() => {});
    setLoadingShops(true);
    getAllShops().then(setShops).catch(() => {}).finally(() => setLoadingShops(false));
  }, []);

  // Listings — reload on category change
  useEffect(() => {
    setLoadingListings(true);
    setDisplayedCount(PAGE_SIZE);
    const fetch = selectedCategory === "All"
      ? getAllShopListings(60)
      : getShopListingsByCategory(selectedCategory, 60);
    fetch
      .then(setListings)
      .catch(() => setListings([]))
      .finally(() => setLoadingListings(false));
  }, [selectedCategory]);

  const visibleListings = listings.slice(0, displayedCount);
  const hasMore = displayedCount < listings.length;

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await new Promise((r) => setTimeout(r, 300));
    setDisplayedCount((n) => n + PAGE_SIZE);
    setLoadingMore(false);
  };

  return (
    <div className="max-w-2xl mx-auto pb-32">
      {/* Hero */}
      <div className="pt-4">
        <HeroBanner ads={ads} />
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 mb-5 pb-1">
        {["All", ...SHOP_CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat as ShopCategory | "All")}
            className={`shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all whitespace-nowrap ${
              selectedCategory === cat
                ? "bg-[#003366] dark:bg-blue-600 text-white border-[#003366] dark:border-blue-600"
                : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-[#003366] dark:hover:border-blue-500"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Featured Shops */}
      <div className="mb-6">
        <div className="flex items-center justify-between px-4 mb-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">Featured Shops</h2>
          <Link href="/campus-market" className="text-xs text-[#003366] dark:text-blue-400 font-semibold flex items-center gap-0.5">
            See all <ChevronRight size={12} />
          </Link>
        </div>
        {loadingShops ? (
          <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex flex-col items-center w-[100px] shrink-0 animate-pulse">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-slate-700 mb-2" />
                <div className="h-2.5 bg-gray-100 dark:bg-slate-700 rounded w-16 mb-1" />
                <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded w-12" />
              </div>
            ))}
          </div>
        ) : shops.length === 0 ? (
          <div className="px-4 py-4 text-center text-xs text-gray-400 dark:text-slate-500">
            No shops yet — be the first to open one!
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4">
            {shops.map((s) => <ShopCard key={s.id} shop={s} />)}
          </div>
        )}
      </div>

      {/* Listings grid */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">
            {selectedCategory === "All" ? "All Listings" : selectedCategory}
            {!loadingListings && (
              <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-slate-500">({listings.length})</span>
            )}
          </h2>
        </div>

        {loadingListings ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => <ListingSkeleton key={i} />)}
          </div>
        ) : visibleListings.length === 0 ? (
          <div className="text-center py-16">
            <Package size={40} className="mx-auto text-gray-200 dark:text-slate-700 mb-3" />
            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No listings yet</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 mb-4">Be the first to open a shop!</p>
            <Link href="/create-shop">
              <button className="bg-[#003366] dark:bg-blue-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-[#002244] transition">
                Open Your Shop
              </button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {visibleListings.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
            {hasMore && (
              <div className="mt-5 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-8 py-2.5 border border-[#003366]/30 dark:border-blue-500/30 text-[#003366] dark:text-blue-400 text-sm font-semibold rounded-xl hover:bg-[#003366]/5 transition disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating "Open Your Shop" CTA */}
      <div className="fixed bottom-20 right-4 z-40 md:hidden">
        <Link href="/create-shop">
          <button className="flex items-center gap-2 bg-[#003366] dark:bg-blue-600 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl hover:bg-[#002244] dark:hover:bg-blue-700 transition active:scale-95">
            <Store size={15} /> Open Your Shop
          </button>
        </Link>
      </div>
    </div>
  );
}
