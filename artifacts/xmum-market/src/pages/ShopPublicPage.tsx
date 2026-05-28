import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  getShopBySlug, getShopListings,
} from "@/lib/shops";
import { Shop, ShopListing } from "@/lib/types";
import {
  ArrowLeft, Store, Loader2, Package, Settings2, Link2, Check,
} from "lucide-react";
import { SiWhatsapp, SiWechat, SiInstagram } from "react-icons/si";
import ShopManagementPanel from "@/components/ShopManagementPanel";
import { RichTextDisplay } from "@/lib/richText";
import AuthModal from "@/components/AuthModal";

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
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
  const TRUNCATE_CHARS = 300;
  const shouldTruncate = bio.trim().length > TRUNCATE_CHARS;
  const displayBio = shouldTruncate && !bioExpanded
    ? bio.trim().slice(0, TRUNCATE_CHARS) + "…"
    : bio.trim();
  return (
    <div className="text-sm text-gray-600 dark:text-slate-300 mt-4 leading-relaxed border-t border-gray-100 dark:border-slate-700 pt-4">
      <RichTextDisplay text={displayBio} className="text-sm text-gray-600 dark:text-slate-400" />
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
  const managementPanelRef = useRef<HTMLDivElement>(null);
  const shopCardRef = useRef<HTMLDivElement>(null);
  const [listings, setListings] = useState<ShopListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showStickyName, setShowStickyName] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasEditParam = params.has("editListing");
    if (hasEditParam) {
      setTimeout(() => {
        managementPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [slug]);

  useEffect(() => {
    const onScroll = () => {
      if (!shopCardRef.current) return;
      const rect = shopCardRef.current.getBoundingClientRect();
      setShowStickyName(rect.bottom < 56);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setShop(null);
    setListings([]);

    (async () => {
      try {
        const s = await getShopBySlug(slug);
        if (cancelled) return;
        if (!s) { setLoading(false); return; }
        setShop(s);

        const lArr = await getShopListings(s.id).catch(() => []);
        if (cancelled) return;
        setListings(lArr);
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
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
        <div className="h-44 sm:h-64 lg:h-72 w-full bg-gray-200 dark:bg-slate-800 animate-pulse" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="lg:grid lg:grid-cols-[320px_1fr] lg:gap-8">
            <div className="bg-white dark:bg-slate-900 rounded-2xl h-64 animate-pulse" />
            <div className="mt-6 lg:mt-0 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden animate-pulse">
                  <div className="aspect-square bg-gray-100 dark:bg-slate-800" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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

  if (shop.isSuspended) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-3">🏪</div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">This shop is currently unavailable</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Please check back later.</p>
        <Link href="/" className="text-[#003366] dark:text-blue-400 underline text-sm">Go home</Link>
      </div>
    );
  }

  const isOwner = user?.uid === shop.ownerId;
  const isEditor = shop.editorIds.includes(user?.uid ?? "");
  const canManage = isOwner || isEditor;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-20">
      {/* Sticky shop name bar — visitors only, appears when info card scrolls out of view */}
      {!canManage && (
        <div
          className={`fixed top-14 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-700 shadow-sm transition-all duration-200 ${
            showStickyName ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-11 flex items-center gap-3">
            {shop.logoUrl ? (
              <img src={shop.logoUrl} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0 border border-gray-100 dark:border-slate-700" />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#003366] to-blue-500 flex items-center justify-center shrink-0">
                <Store size={13} className="text-white" />
              </div>
            )}
            <span className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{shop.name}</span>
            <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">{shop.category}</span>
          </div>
        </div>
      )}

      {/* Full-width Banner */}
      <div
        className="relative h-44 sm:h-64 lg:h-72 w-full"
        style={{
          background: shop.bannerUrl ? undefined : "linear-gradient(135deg, #003366 0%, #0055aa 60%, #0077cc 100%)",
        }}
      >
        {shop.bannerUrl && (
          <img src={shop.bannerUrl} alt="" className="w-full h-full object-cover object-top" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/40 pointer-events-none" />

        <button
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              navigate("/campus-market");
            }
          }}
          className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm text-white p-2.5 rounded-full hover:bg-black/60 transition shadow-lg"
        >
          <ArrowLeft size={18} />
        </button>

        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          title="Copy shop link"
          className="absolute top-4 right-4 flex items-center gap-1.5 text-xs font-medium bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 px-3 py-2 rounded-full transition shadow-lg"
        >
          {copied ? <Check size={13} className="text-green-300" /> : <Link2 size={13} />}
          <span>{copied ? "Copied!" : "Share"}</span>
        </button>
      </div>

      {/* Content area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Two-column grid */}
        <div className="flex flex-col lg:grid lg:grid-cols-[320px_1fr] lg:gap-8 lg:items-start">

          {/* LEFT COLUMN — shop info + management panel */}
          <div className="lg:sticky lg:top-[72px] order-1">
            {/* Shop info card */}
            <div ref={shopCardRef} className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg mt-4 lg:-mt-16 relative z-10 p-5">
              <div className="flex items-start gap-4">
                <div className="w-[72px] h-[72px] lg:w-20 lg:h-20 rounded-2xl border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 overflow-hidden shadow-sm shrink-0 lg:-mt-16">
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
                    <h1 className="text-xl font-display font-bold text-gray-900 dark:text-slate-100 leading-tight">{shop.name}</h1>
                    <span className="text-xs bg-[#003366]/10 dark:bg-blue-900/30 text-[#003366] dark:text-blue-400 font-semibold px-2.5 py-1 rounded-full shrink-0">
                      {shop.category}
                    </span>
                  </div>
                </div>
              </div>

              <ShopBio bio={shop.bio} />

              <div className="flex flex-wrap gap-5 mt-4 text-xs text-gray-500 dark:text-slate-400">
                <span>
                  <strong className="text-gray-800 dark:text-slate-200 text-sm">{listings.length}</strong>
                  {" "}listing{listings.length !== 1 ? "s" : ""}
                </span>
                <span>
                  <strong className="text-gray-800 dark:text-slate-200 text-sm">{shop.totalInquiries}</strong>
                  {" "}inquir{shop.totalInquiries !== 1 ? "ies" : "y"}
                </span>
                {shop.rating != null && shop.reviewCount != null && shop.reviewCount > 0 && (
                  <span>
                    ⭐ <strong className="text-gray-800 dark:text-slate-200 text-sm">{shop.rating.toFixed(1)}</strong>
                    {" "}({shop.reviewCount})
                  </span>
                )}
              </div>

              {(shop.whatsapp || shop.wechat) && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                  {user ? (
                    <div className="flex flex-col gap-2">
                      {shop.whatsapp && (
                        <a
                          href={`https://wa.me/${shop.whatsapp.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-1.5 bg-green-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-green-600 transition shadow-sm"
                        >
                          <SiWhatsapp size={13} /> WhatsApp
                        </a>
                      )}
                      {shop.wechat && (
                        <div className="w-full flex items-center justify-center gap-1.5 bg-[#07C160] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm">
                          <SiWechat size={13} /> {shop.wechat}
                        </div>
                      )}
                      {shop.instagram && (
                        <a
                          href={`https://instagram.com/${shop.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition shadow-sm"
                        >
                          <SiInstagram size={13} /> @{shop.instagram}
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      <button
                        onClick={() => setShowAuth(true)}
                        className="text-[#003366] dark:text-blue-400 font-semibold underline"
                      >
                        Sign in
                      </button>
                      {" "}to see contact details
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Management panel — in left column (desktop + mobile) */}
            {canManage && (
              <div className="mt-6" ref={managementPanelRef}>
                <div className="border-t-2 border-dashed border-gray-200 dark:border-slate-700 pt-5 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Settings2 size={16} className="text-[#003366] dark:text-blue-400" />
                    <h2 className="section-header">⚙️ Shop Management</h2>
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

          {/* RIGHT COLUMN — listings grid */}
          <div className="order-2 mt-6 lg:mt-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-header">
                🛍️ Listings
                <span className="ml-2 text-xs font-normal text-gray-400 dark:text-slate-500">({listings.length})</span>
              </h2>
              {listings.length > 0 && (
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  {listings.length} item{listings.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {listings.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800">
                <div className="text-5xl mb-3">🛍️</div>
                <p className="text-base font-semibold text-gray-700 dark:text-slate-300 mb-1">No listings yet</p>
                <p className="text-sm text-gray-400 dark:text-slate-500">
                  {canManage ? "Add your first listing using the panel on the left." : "Check back soon!"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {listings.map((l) => (
                  <Link
                    key={l.id}
                    href={`/shop-listing/${l.id}`}
                    className="card-base overflow-hidden text-left hover:scale-[1.02] hover:shadow-md transition-all duration-200 active:scale-[0.98] block"
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
                      {l.description && (
                        <p className="line-clamp-2 text-[11px] text-gray-500 dark:text-slate-400 mb-1">{l.description}</p>
                      )}
                      <PriceLabel listing={l} />
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 truncate">{shop.name}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
