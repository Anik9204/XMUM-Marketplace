import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAllShops, getAllShopListings, getShopListingsByCategory, getApprovedShopAds,
  getShopsByOwner, getShopsWhereEditor, getInquiriesForShop,
} from "@/lib/shops";
import { Shop, ShopListing, ShopAd, ShopCategory } from "@/lib/types";
import { Store, ChevronRight, Package, Plus, Settings2 } from "lucide-react";

const SHOP_CATEGORIES: ShopCategory[] = [
  "Food & Beverage", "Tutoring & Education", "Fashion & Apparel", "Electronics",
  "Beauty & Wellness", "Transport & Rental", "Handmade & Custom", "Books & Stationery",
  "Services", "Travel & Lifestyle", "Others",
];

const PAGE_SIZE = 12;

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
      <>
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
      `}</style>
      <div
        className="relative rounded-2xl overflow-hidden mb-4"
        style={{ background: "linear-gradient(135deg, #003366 0%, #0066cc 60%, #0099ff 100%)" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)",
            backgroundSize: "200% 100%",
            animation: "heroShimmer 3.5s ease-in-out infinite",
          }}
        />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between px-6 py-8 sm:py-10 gap-6">
          <div className="flex-1">
            <p
              className="hero-fade-up text-white/70 text-xs font-semibold uppercase tracking-widest mb-1"
              style={{ animationDuration: "350ms", animationDelay: "0ms", animationFillMode: "both" }}
            >Campus Market</p>
            <h1
              className="hero-fade-up text-white text-2xl sm:text-3xl font-black leading-tight mb-2"
              style={{ animationDuration: "500ms", animationDelay: "80ms", animationFillMode: "both" }}
            >
              Shop from fellow<br />XMUM students
            </h1>
            <p
              className="hero-fade-up text-white/70 text-sm mb-4"
              style={{ animationDuration: "500ms", animationDelay: "180ms", animationFillMode: "both" }}
            >Discover food, services, and more — right on campus.</p>
            <Link href="/create-shop">
              <button
                className="hero-fade-up bg-white text-[#003366] text-xs font-bold px-4 py-2 rounded-xl hover:bg-gray-100 transition"
                style={{ animationDuration: "400ms", animationDelay: "280ms", animationFillMode: "both" }}
              >
                Open Your Shop →
              </button>
            </Link>
          </div>
          <div className="hidden lg:block lg:w-64 lg:h-40 rounded-xl overflow-hidden opacity-90 shrink-0 border border-white/20 bg-white/10">
            <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">Preview</div>
          </div>
        </div>
        <div className="absolute right-4 bottom-0 opacity-10 text-[120px] leading-none select-none pointer-events-none">🛍️</div>
      </div>
      </>
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group">
        <div className="h-28 bg-gradient-to-br from-[#003366] to-[#0066cc] overflow-hidden flex items-center justify-center relative">
          {shop.logoUrl ? (
            <img src={shop.logoUrl} alt="" className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <Store size={36} className="text-white/40" />
          )}
          <div className="absolute top-2 left-2">
            <span className="text-[10px] font-bold text-white bg-black/30 px-2 py-0.5 rounded-full uppercase tracking-wide">
              {shop.category.split(" ")[0]}
            </span>
          </div>
        </div>
        <div className="p-3">
          <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{shop.name}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">{Math.max(0, shop.totalListings ?? 0)} Listing{Math.max(0, shop.totalListings ?? 0) !== 1 ? "s" : ""}</p>
          {(shop.reviewCount ?? 0) > 0 && (
            <p className="text-xs text-amber-500 font-semibold mt-0.5">★ {(shop.rating ?? 0).toFixed(1)}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Listing card ──────────────────────────────────────────────────────────────
function ListingCard({ listing }: { listing: ShopListing }) {
  const [, navigate] = useLocation();
  return (
    <div
      onClick={() => navigate(`/shop-listing/${listing.id}`)}
      className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98] cursor-pointer"
    >
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
        <Link
          href={`/shop/${listing.shopSlug}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] text-[#003366] dark:text-blue-400 font-semibold hover:underline mt-0.5 inline-block"
        >
          View Shop →
        </Link>
      </div>
    </div>
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

// ── My Shop card ──────────────────────────────────────────────────────────────
function MyShopCard({ shop, pendingCount }: { shop: Shop; pendingCount: number }) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl px-4 py-3 shadow-sm">
      <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 overflow-hidden shrink-0 flex items-center justify-center">
        {shop.logoUrl ? (
          <img src={shop.logoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Store size={22} className="text-[#003366] dark:text-blue-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{shop.name}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{shop.category}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {pendingCount > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">
            {pendingCount} pending
          </span>
        )}
        <Link href={`/shop-dashboard/${shop.id}`}>
          <button className="text-xs font-semibold border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition">
            Manage Shop
          </button>
        </Link>
        <Link href={`/shop/${shop.slug}`}>
          <button className="text-xs font-semibold bg-[#003366] dark:bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-[#002244] dark:hover:bg-blue-700 transition">
            View Public Page
          </button>
        </Link>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CampusMarketPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const listingsRef = useRef<HTMLDivElement>(null);

  const [ads, setAds] = useState<ShopAd[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [listings, setListings] = useState<ShopListing[]>([]);
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);
  const [selectedCategory, setSelectedCategory] = useState<ShopCategory | "All">("All");
  const [loadingShops, setLoadingShops] = useState(true);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [myShops, setMyShops] = useState<Shop[]>([]);
  const [myShopPending, setMyShopPending] = useState<Record<string, number>>({});
  const [loadingMyShops, setLoadingMyShops] = useState(false);

  // Load user's own shops
  useEffect(() => {
    if (!user) { setMyShops([]); return; }
    setLoadingMyShops(true);
    Promise.all([
      getShopsByOwner(user.uid),
      getShopsWhereEditor(user.uid),
    ])
      .then(([owned, edited]) => {
        const combined = [...owned];
        for (const s of edited) {
          if (!combined.find((x) => x.id === s.id)) combined.push(s);
        }
        setMyShops(combined);
        // Fetch pending counts for each shop
        Promise.all(
          combined.map(async (s) => {
            try {
              const inqs = await getInquiriesForShop(s.id);
              const pending = inqs.filter((i) => i.status === "pending").length;
              return [s.id, pending] as const;
            } catch {
              return [s.id, 0] as const;
            }
          })
        ).then((pairs) => setMyShopPending(Object.fromEntries(pairs)));
      })
      .catch(() => setMyShops([]))
      .finally(() => setLoadingMyShops(false));
  }, [user?.uid]);

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
    <div className="max-w-6xl mx-auto pb-32 px-4">
      {/* Hero */}
      <div className="pt-4">
        <HeroBanner ads={ads} />
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 pt-1 flex-1">
        {["All", ...SHOP_CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setSelectedCategory(cat as ShopCategory | "All");
              setTimeout(() => {
                const el = listingsRef.current;
                if (el) {
                  const top = el.getBoundingClientRect().top + window.scrollY - 80;
                  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
                }
              }, 50);
            }}
            className={`chip shrink-0 ${selectedCategory === cat ? "chip-active" : ""}`}
          >
            {cat}
          </button>
        ))}
        </div>
        <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0 font-medium pr-1">Filters</span>
      </div>

      {/* My Shop section — visible only for owners/editors */}
      {user && myShops.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="section-header">⚙️ My Shop</h2>
          </div>
          <div className="space-y-2">
            {myShops.map((s) => (
              <MyShopCard key={s.id} shop={s} pendingCount={myShopPending[s.id] ?? 0} />
            ))}
          </div>
        </div>
      )}

      {/* Featured Shops */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-header">🏪 Featured Shops</h2>
          <Link href="/campus-market" className="text-xs text-[#003366] dark:text-blue-400 font-semibold flex items-center gap-0.5">
            See all <ChevronRight size={12} />
          </Link>
        </div>
        {loadingShops ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-pulse">
                <div className="h-28 bg-gray-100 dark:bg-slate-700" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : shops.length === 0 ? (
          <div className="py-6 text-center px-4">
            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No shops open yet</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">
              XMUM students can open a campus shop to sell food, services, handmade goods, and more.
            </p>
            <Link href="/create-shop" className="inline-block mt-3 text-xs font-semibold text-[#003366] dark:text-blue-400 hover:underline">
              Open your shop →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {shops.slice(0, 8).map((s) => <ShopCard key={s.id} shop={s} />)}
          </div>
        )}
      </div>

      {/* Listings grid */}
      <div ref={listingsRef}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-header">
            🛍️ {selectedCategory === "All" ? "All Listings" : selectedCategory}
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
            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No shop listings yet</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 mb-1 max-w-xs mx-auto">
              Campus shops sell food, services, fashion, electronics, and more. Open a shop or check back soon.
            </p>
            <Link href="/create-shop">
              <button className="btn-primary px-5 mt-4">
                Open Your Shop
              </button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleListings.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
            {hasMore && (
              <div className="mt-5 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="btn-ghost px-8 disabled:opacity-50"
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
          <button className="btn-primary flex items-center gap-2 px-4 py-3 shadow-[0_4px_20px_rgb(0,51,102,0.4)] active:scale-95">
            <Store size={15} /> Open Your Shop
          </button>
        </Link>
      </div>
    </div>
  );
}
