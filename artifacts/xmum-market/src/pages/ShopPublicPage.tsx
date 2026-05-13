import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  getShopBySlug, getShopListings, getShopReviews,
} from "@/lib/shops";
import { Shop, ShopListing, ShopReview } from "@/lib/types";
import {
  ArrowLeft, Star, Store, Loader2, Package, Settings2,
} from "lucide-react";
import { SiWhatsapp, SiWechat } from "react-icons/si";
import ShopManagementPanel from "@/components/ShopManagementPanel";

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-gray-300 dark:text-slate-600"}
        />
      ))}
    </div>
  );
}

function PriceLabel({ listing }: { listing: ShopListing }) {
  if (listing.pricingModel === "negotiable") return <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Negotiable</span>;
  if (listing.price === undefined) return null;
  const suffix = listing.pricingModel && listing.pricingModel !== "fixed"
    ? ` / ${listing.pricingModel.replace("_", " ")}`
    : "";
  return <span className="text-sm font-bold text-[#003366] dark:text-blue-300">RM {listing.price.toFixed(2)}{suffix}</span>;
}

function ShopBio({ bio }: { bio?: string }) {
  const [bioExpanded, setBioExpanded] = useState(false);
  if (!bio) return null;
  const bioWords = bio.trim().split(/\s+/);
  const shouldTruncate = bioWords.length > 60;
  const displayBio = shouldTruncate && !bioExpanded
    ? bioWords.slice(0, 60).join(" ") + "…"
    : bio;
  return (
    <div className="text-sm text-gray-600 dark:text-slate-300 mt-4 leading-relaxed border-t border-gray-100 dark:border-slate-700 pt-4">
      <p>{displayBio}</p>
      {shouldTruncate && (
        <button
          onClick={() => setBioExpanded((v) => !v)}
          className="text-xs text-[#003366] dark:text-blue-400 font-semibold mt-1 hover:underline"
        >
          {bioExpanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

export default function ShopPublicPage() {
  const [, params] = useRoute("/shop/:slug");
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const slug = params?.slug ?? "";

  const [shop, setShop] = useState<Shop | null>(null);
  const [listings, setListings] = useState<ShopListing[]>([]);
  const [reviews, setReviews] = useState<ShopReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setShop(null);
    setListings([]);
    setReviews([]);

    (async () => {
      try {
        const s = await getShopBySlug(slug);
        if (cancelled) return;
        if (!s) { setLoading(false); return; }
        setShop(s);

        const [lArr, rArr] = await Promise.allSettled([
          getShopListings(s.id),
          getShopReviews(s.id),
        ]);
        if (cancelled) return;
        if (lArr.status === "fulfilled") setListings(lArr.value);
        if (rArr.status === "fulfilled") setReviews(rArr.value);
      } catch (err) {
        console.error("[ShopPublicPage] load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-[#003366] dark:text-blue-400" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Store size={40} className="mx-auto text-gray-300 dark:text-slate-600 mb-3" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">Shop not found</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">This shop doesn't exist or may have been removed.</p>
        <Link href="/" className="text-[#003366] dark:text-blue-400 underline text-sm">Go home</Link>
      </div>
    );
  }

  const isOwner = user?.uid === shop.ownerId;
  const isEditor = shop.editorIds.includes(user?.uid ?? "");
  const canManage = isOwner || isEditor;

  return (
    <div className="max-w-2xl mx-auto pb-28 min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Banner */}
      <div
        className="relative h-44 sm:h-56 w-full"
        style={{
          background: shop.bannerUrl ? undefined : "linear-gradient(135deg, #003366 0%, #0055aa 60%, #0077cc 100%)",
        }}
      >
        {shop.bannerUrl && (
          <img src={shop.bannerUrl} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/40 pointer-events-none" />

        <button
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              navigate("/market");
            }
          }}
          className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm text-white p-2.5 rounded-full hover:bg-black/60 transition shadow-lg"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      {/* Shop info card */}
      <div className="px-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg -mt-10 relative z-10 p-5">
          <div className="flex items-start gap-4">
            <div className="w-[72px] h-[72px] rounded-2xl border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 overflow-hidden shadow-sm shrink-0 -mt-10">
              {shop.logoUrl ? (
                <img src={shop.logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#003366] to-blue-500">
                  <Store size={30} className="text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-tight">{shop.name}</h1>
                <span className="text-xs bg-[#003366]/10 dark:bg-blue-900/30 text-[#003366] dark:text-blue-400 font-semibold px-2.5 py-1 rounded-full shrink-0">
                  {shop.category}
                </span>
              </div>
              {shop.reviewCount > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <StarRow rating={shop.rating} size={13} />
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {shop.rating.toFixed(1)} ({shop.reviewCount} review{shop.reviewCount !== 1 ? "s" : ""})
                  </span>
                </div>
              )}
            </div>
          </div>

          <ShopBio bio={shop.bio} />

          <div className="flex gap-5 mt-4 text-xs text-gray-500 dark:text-slate-400">
            <span>
              <strong className="text-gray-800 dark:text-slate-200 text-sm">{shop.totalListings}</strong>
              {" "}listing{shop.totalListings !== 1 ? "s" : ""}
            </span>
            {shop.reviewCount > 0 && (
              <span>
                <strong className="text-gray-800 dark:text-slate-200 text-sm">{shop.reviewCount}</strong>
                {" "}review{shop.reviewCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {(shop.whatsapp || shop.wechat) && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
              {shop.whatsapp && (
                <a
                  href={`https://wa.me/${shop.whatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-green-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-green-600 transition shadow-sm"
                >
                  <SiWhatsapp size={13} /> WhatsApp
                </a>
              )}
              {shop.wechat && (
                <div className="flex items-center gap-1.5 bg-[#07C160] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm">
                  <SiWechat size={13} /> {shop.wechat}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Listings grid */}
      <div className="px-4 mt-6">
        <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-3">
          Listings
          <span className="ml-2 text-xs font-normal text-gray-400 dark:text-slate-500">({listings.length})</span>
        </h2>
        {listings.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl">
            <Package size={32} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
            <p className="text-sm text-gray-400 dark:text-slate-500">No listings yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {listings.map((l) => (
              <Link
                key={l.id}
                href={`/shop-listing/${l.id}`}
                className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden text-left hover:shadow-md transition-shadow active:scale-[0.98] shadow-sm block"
              >
                {l.photos[0] ? (
                  <img src={l.photos[0]} alt="" className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
                    <Package size={28} className="text-gray-300 dark:text-slate-500" />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-900 dark:text-slate-100 line-clamp-2 mb-1">{l.title}</p>
                  {l.reviewCount > 0 && (
                    <div className="flex items-center gap-1 mb-0.5">
                      <StarRow rating={l.rating} size={10} />
                      <span className="text-[10px] text-gray-400 dark:text-slate-500">({l.reviewCount})</span>
                    </div>
                  )}
                  <PriceLabel listing={l} />
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 truncate">{shop.name}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-3">
            Reviews
            <span className="ml-2 text-xs font-normal text-gray-400 dark:text-slate-500">({reviews.length})</span>
          </h2>
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {r.reviewerAvatar ? (
                      <img src={r.reviewerAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#003366]/10 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-[#003366] dark:text-blue-400">{r.reviewerName[0]?.toUpperCase()}</span>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-slate-100">{r.reviewerName}</p>
                      <StarRow rating={r.rating} size={11} />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">{relativeTime(r.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1 italic">re: {r.listingTitle}</p>
                {r.comment && <p className="text-sm text-gray-700 dark:text-slate-300">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Management Section — owners and editors only */}
      {canManage && (
        <div className="px-4 mt-8">
          <div className="border-t-2 border-dashed border-gray-200 dark:border-slate-700 pt-6 mb-5">
            <div className="flex items-center gap-2 mb-1">
              <Settings2 size={16} className="text-[#003366] dark:text-blue-400" />
              <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
                Shop Management
              </h2>
              <span className="text-xs text-gray-400 dark:text-slate-500 font-normal">
                ({isOwner ? "Owner" : "Editor"})
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500">Only you can see this section.</p>
          </div>
          <ShopManagementPanel
            shopId={shop.id}
            initialShop={shop}
            isOwner={isOwner}
            isEditor={isEditor}
            onShopDeleted={() => navigate("/profile")}
            onShopUpdated={(updated) => setShop(updated)}
          />
        </div>
      )}
    </div>
  );
}
