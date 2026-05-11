import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  getShopBySlug, getShopListings, getShopReviews,
  createInquiry, incrementShopListingView,
} from "@/lib/shops";
import { Shop, ShopListing, ShopReview } from "@/lib/types";
import AuthModal from "@/components/AuthModal";
import {
  ArrowLeft, Star, Store, MessageCircle, ChevronLeft, ChevronRight,
  X, Loader2, Send, Package, Settings2,
} from "lucide-react";
import { SiWhatsapp, SiWechat } from "react-icons/si";

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

// ── Listing Detail Modal ──────────────────────────────────────────────────────

function ListingModal({
  listing, shop, onClose, canManage,
}: { listing: ShopListing; shop: Shop; onClose: () => void; canManage?: boolean }) {
  const { user, userProfile } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [showInquiry, setShowInquiry] = useState(false);
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [inquiryError, setInquiryError] = useState("");

  const handleInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) { setShowAuth(true); return; }
    if (quantity < 1) { setInquiryError("Quantity must be at least 1."); return; }
    setInquiryError("");
    setSending(true);
    try {
      await createInquiry({
        shopId: shop.id,
        shopName: shop.name,
        shopListingId: listing.id,
        listingTitle: listing.title,
        buyerId: user.uid,
        buyerName: userProfile.fullName || userProfile.displayName || user.email || "Anonymous",
        buyerEmail: user.email ?? "",
        quantity,
        note: note.trim(),
      });
      setSent(true);
      setShowInquiry(false);
    } catch (err: any) {
      setInquiryError(err.message ?? "Failed to send inquiry.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Photos */}
        {listing.photos.length > 0 ? (
          <div className="relative aspect-square bg-gray-100 dark:bg-slate-800">
            <img src={listing.photos[photoIdx]} alt="" className="w-full h-full object-cover" />
            {listing.photos.length > 1 && (
              <>
                <button onClick={() => setPhotoIdx((i) => Math.max(0, i - 1))} disabled={photoIdx === 0} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setPhotoIdx((i) => Math.min(listing.photos.length - 1, i + 1))} disabled={photoIdx === listing.photos.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {listing.photos.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === photoIdx ? "bg-white" : "bg-white/40"}`} />
                  ))}
                </div>
              </>
            )}
            <button onClick={onClose} className="absolute top-3 right-3 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="relative h-32 bg-gradient-to-br from-[#003366] to-blue-500 flex items-center justify-center">
            <Package size={40} className="text-white/50" />
            <button onClick={onClose} className="absolute top-3 right-3 bg-black/30 text-white rounded-full p-1.5"><X size={16} /></button>
          </div>
        )}

        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{listing.title}</h2>
            <div className="mt-1"><PriceLabel listing={listing} /></div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{listing.category}</p>
          </div>
          {listing.description && (
            <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{listing.description}</p>
          )}

          {canManage ? (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400 text-center font-medium">
              You manage this shop — go to your dashboard to view inquiries.
            </div>
          ) : sent ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-400 font-semibold text-center">
              ✅ Inquiry sent! The shop will contact you soon.
            </div>
          ) : showInquiry ? (
            <form onSubmit={handleInquiry} className="space-y-3 bg-blue-50 dark:bg-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Send Inquiry</h3>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Quantity</label>
                <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Message (optional, max 500 chars)</label>
                <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ask a question or leave a note for the shop..." className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none" />
              </div>
              {inquiryError && <p className="text-xs text-red-500">{inquiryError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={sending} className="flex-1 bg-[#003366] dark:bg-blue-600 text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-[#002244] disabled:opacity-50 transition flex items-center justify-center gap-2">
                  {sending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={13} /> Send</>}
                </button>
                <button type="button" onClick={() => setShowInquiry(false)} className="px-4 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 font-semibold text-sm rounded-xl hover:bg-gray-200 transition">Cancel</button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => { if (!user) { setShowAuth(true); } else { setShowInquiry(true); } }}
              className="w-full min-h-[48px] bg-[#003366] dark:bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-[#002244] dark:hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <MessageCircle size={16} /> Send Inquiry
            </button>
          )}
        </div>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ShopPublicPage() {
  const [, params] = useRoute("/shop/:slug");
  const [location] = useLocation();
  const { user } = useAuth();
  const slug = params?.slug ?? "";

  const [shop, setShop] = useState<Shop | null>(null);
  const [listings, setListings] = useState<ShopListing[]>([]);
  const [reviews, setReviews] = useState<ShopReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState<ShopListing | null>(null);

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

  // Auto-open a specific listing if ?listing=ID is in the URL
  useEffect(() => {
    if (!listings.length) return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("listing");
    if (targetId) {
      const found = listings.find((l) => l.id === targetId);
      if (found) setSelectedListing(found);
    }
  }, [listings]);

  const handleSelectListing = async (l: ShopListing) => {
    setSelectedListing(l);
    try { await incrementShopListingView(l.id); } catch {}
  };

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
          onClick={() => window.history.back()}
          className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm text-white p-2.5 rounded-full hover:bg-black/60 transition shadow-lg"
        >
          <ArrowLeft size={18} />
        </button>

        {canManage && (
          <Link
            href={`/shop-dashboard/${shop.id}`}
            className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-black/60 transition flex items-center gap-1.5 shadow-lg"
          >
            <Settings2 size={13} /> Manage
          </Link>
        )}
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

          {shop.bio && (
            <p className="text-sm text-gray-600 dark:text-slate-300 mt-4 leading-relaxed border-t border-gray-100 dark:border-slate-700 pt-4">
              {shop.bio}
            </p>
          )}

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
              <button
                key={l.id}
                onClick={() => handleSelectListing(l)}
                className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden text-left hover:shadow-md transition-shadow active:scale-[0.98] shadow-sm"
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
                  <PriceLabel listing={l} />
                </div>
              </button>
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

      {/* Listing detail modal */}
      {selectedListing && (
        <ListingModal listing={selectedListing} shop={shop} onClose={() => setSelectedListing(null)} canManage={canManage} />
      )}
    </div>
  );
}
