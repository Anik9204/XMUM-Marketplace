import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  getShopBySlug, getShopListings,
} from "@/lib/shops";
import { Shop, ShopListing } from "@/lib/types";
import {
  ArrowLeft, Store, Loader2, Package, Settings2, Star, MapPin, Clock, Share2, Heart, MessageCircle, ShieldCheck, Grid3X3, List,
} from "lucide-react";
import { SiWhatsapp, SiWechat } from "react-icons/si";
import ShopManagementPanel from "@/components/ShopManagementPanel";
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
  if (listing.pricingModel === "negotiable") return <span className="text-sm font-bold text-primary">Negotiable</span>;
  if (listing.price === undefined) return null;
  const suffix = listing.pricingModel && listing.pricingModel !== "fixed"
    ? ` / ${listing.pricingModel.replace("_", " ")}`
    : "";
  return <span className="text-base font-bold text-foreground">RM {listing.price.toFixed(2)}{suffix}</span>;
}

function ShopBio({ bio }: { bio?: string }) {
  const [bioExpanded, setBioExpanded] = useState(false);
  if (!bio) return null;
  const TRUNCATE_CHARS = 200;
  const shouldTruncate = bio.trim().length > TRUNCATE_CHARS;
  const displayBio = shouldTruncate && !bioExpanded
    ? bio.trim().slice(0, TRUNCATE_CHARS) + "..."
    : bio.trim();
  return (
    <div className="text-sm text-muted-foreground leading-relaxed">
      <p className="whitespace-pre-wrap">{displayBio}</p>
      {shouldTruncate && (
        <button
          onClick={() => setBioExpanded((v) => !v)}
          className="text-primary font-semibold mt-1 hover:underline text-xs"
        >
          {bioExpanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

// Stat card component
function StatCard({ icon: Icon, value, label }: { icon: React.ElementType; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-primary" />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// Listing card component
function ListingCard({ listing, shopName }: { listing: ShopListing; shopName: string }) {
  return (
    <Link
      href={`/shop-listing/${listing.id}`}
      className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 block"
    >
      <div className="relative aspect-square overflow-hidden">
        {listing.photos[0] ? (
          <img 
            src={listing.photos[0]} 
            alt={listing.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
            <Package size={32} className="text-muted-foreground/50" />
          </div>
        )}
        {/* Favorite button */}
        <button 
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
          onClick={(e) => { e.preventDefault(); }}
        >
          <Heart size={16} className="text-muted-foreground" />
        </button>
        {/* Status badge */}
        {listing.status === "sold" && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">SOLD</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <PriceLabel listing={listing} />
        <h3 className="text-sm font-medium text-foreground line-clamp-2 mt-1 leading-snug">{listing.title}</h3>
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <Clock size={12} />
          <span>{relativeTime(listing.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}

export default function ShopPublicPage() {
  const [, params] = useRoute("/shop/:slug");
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const slug = params?.slug ?? "";

  const [shop, setShop] = useState<Shop | null>(null);
  const managementPanelRef = useRef<HTMLDivElement>(null);
  const [listings, setListings] = useState<ShopListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Store size={48} className="mx-auto text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Shop not found</h2>
        <p className="text-sm text-muted-foreground mb-6">This shop doesn&apos;t exist or may have been removed.</p>
        <Link href="/" className="btn-primary">Go home</Link>
      </div>
    );
  }

  if (shop.isSuspended) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Store size={48} className="mx-auto text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">This shop is currently unavailable</h2>
        <p className="text-sm text-muted-foreground mb-6">Please check back later.</p>
        <Link href="/" className="btn-primary">Go home</Link>
      </div>
    );
  }

  const isOwner = user?.uid === shop.ownerId;
  const isEditor = shop.editorIds.includes(user?.uid ?? "");
  const canManage = isOwner || isEditor;

  return (
    <div className="min-h-screen bg-background">
      {/* Full-width Banner */}
      <div className="relative w-full h-48 sm:h-56 md:h-64 lg:h-72">
        {shop.bannerUrl ? (
          <img src={shop.bannerUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary via-primary/80 to-primary/60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        {/* Back button */}
        <button
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              navigate("/market");
            }
          }}
          className="absolute top-4 left-4 bg-black/30 backdrop-blur-md text-white p-2.5 rounded-full hover:bg-black/50 transition-all shadow-lg"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Share button */}
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: shop.name, url: window.location.href });
            } else {
              navigator.clipboard.writeText(window.location.href);
            }
          }}
          className="absolute top-4 right-4 bg-black/30 backdrop-blur-md text-white p-2.5 rounded-full hover:bg-black/50 transition-all shadow-lg"
        >
          <Share2 size={20} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10 pb-24">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          
          {/* Left Column - Shop Info (Sticky on desktop) */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0">
            <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden lg:sticky lg:top-20">
              {/* Shop Header */}
              <div className="p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  {/* Logo */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-card bg-muted overflow-hidden shadow-lg shrink-0 -mt-12">
                    {shop.logoUrl ? (
                      <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-primary/70">
                        <Store size={32} className="text-white" />
                      </div>
                    )}
                  </div>

                  {/* Shop name and category */}
                  <div className="flex-1 min-w-0 pt-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight truncate">{shop.name}</h1>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full">
                        {shop.category}
                      </span>
                      {shop.approvalStatus === "approved" && (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <ShieldCheck size={14} />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                {shop.bio && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <ShopBio bio={shop.bio} />
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <StatCard icon={Package} value={shop.totalListings} label="Listings" />
                  <StatCard 
                    icon={Star} 
                    value={shop.rating ? shop.rating.toFixed(1) : "New"} 
                    label={shop.reviewCount ? `${shop.reviewCount} reviews` : "No reviews yet"} 
                  />
                </div>

                {/* Member since */}
                <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                  <Clock size={14} />
                  <span>Member since {new Date(shop.createdAt).toLocaleDateString("en-MY", { month: "short", year: "numeric" })}</span>
                </div>
              </div>

              {/* Contact Section */}
              <div className="border-t border-border p-5 sm:p-6 bg-muted/30">
                <h3 className="text-sm font-semibold text-foreground mb-3">Contact Seller</h3>
                {user ? (
                  <div className="flex flex-col gap-2">
                    {shop.whatsapp && (
                      <a
                        href={`https://wa.me/${shop.whatsapp.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold px-4 py-3 rounded-xl hover:bg-[#20BD5A] transition-all shadow-sm w-full"
                      >
                        <SiWhatsapp size={18} />
                        Chat on WhatsApp
                      </a>
                    )}
                    {shop.wechat && (
                      <div className="flex items-center justify-center gap-2 bg-[#07C160] text-white font-semibold px-4 py-3 rounded-xl shadow-sm w-full">
                        <SiWechat size={18} />
                        WeChat: {shop.wechat}
                      </div>
                    )}
                    {!shop.whatsapp && !shop.wechat && (
                      <p className="text-sm text-muted-foreground text-center py-2">No contact info provided</p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground mb-3">Sign in to see contact details</p>
                    <button
                      onClick={() => setShowAuth(true)}
                      className="btn-primary w-full"
                    >
                      Sign In
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Listings */}
          <div className="flex-1 min-w-0">
            {/* Listings Header */}
            <div className="bg-card rounded-2xl shadow-lg border border-border p-4 sm:p-5 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">Listings</h2>
                  <p className="text-sm text-muted-foreground">{listings.length} item{listings.length !== 1 ? "s" : ""} available</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 rounded-lg transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                  >
                    <Grid3X3 size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                  >
                    <List size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Listings Grid */}
            {listings.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center">
                <Package size={48} className="mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold text-foreground mb-1">No listings yet</h3>
                <p className="text-sm text-muted-foreground">This shop hasn&apos;t added any products.</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {listings.map((l) => (
                  <ListingCard key={l.id} listing={l} shopName={shop.name} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {listings.map((l) => (
                  <Link
                    key={l.id}
                    href={`/shop-listing/${l.id}`}
                    className="flex gap-4 bg-card rounded-xl border border-border p-3 hover:shadow-lg transition-all group"
                  >
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden shrink-0">
                      {l.photos[0] ? (
                        <img src={l.photos[0]} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Package size={24} className="text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                      <PriceLabel listing={l} />
                      <h3 className="text-sm sm:text-base font-medium text-foreground line-clamp-2 mt-1">{l.title}</h3>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {relativeTime(l.createdAt)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Management Section - owners and editors only */}
            {canManage && (
              <div className="mt-8" ref={managementPanelRef}>
                <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
                  <div className="border-b border-border p-5 bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Settings2 size={20} className="text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-foreground">Shop Management</h2>
                        <p className="text-xs text-muted-foreground">
                          {isOwner ? "Owner access" : "Editor access"} - Only you can see this section
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
                    <ShopManagementPanel
                      shopId={shop.id}
                      initialShop={shop}
                      isOwner={isOwner}
                      isEditor={isEditor}
                      onShopDeleted={() => navigate("/profile")}
                      onShopUpdated={(updated) => setShop(updated)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
