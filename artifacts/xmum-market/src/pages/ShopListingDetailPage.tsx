import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getShopById, incrementShopListingView, deleteShopListing } from "@/lib/shops";
import { getOrCreateConversation } from "@/lib/messaging";
import ReportHoldModal from "@/components/ReportHoldModal";
import { Shop, ShopListing, Listing } from "@/lib/types";
import AuthModal from "@/components/AuthModal";
import ReportModal from "@/components/ReportModal";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Package,
  Loader2, Store, MessageSquare, Edit2, Trash2, MoreHorizontal, Flag,
} from "lucide-react";
import { SiWhatsapp, SiWechat, SiInstagram } from "react-icons/si";

function PriceLabel({ listing }: { listing: ShopListing }) {
  if (listing.pricingModel === "negotiable")
    return <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">Negotiable</span>;
  if (listing.price === undefined) return null;
  const suffix =
    listing.pricingModel && listing.pricingModel !== "fixed"
      ? ` / ${listing.pricingModel.replace("_", " ")}`
      : "";
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-sm font-semibold text-[#003366]/60 dark:text-blue-400/60 -mb-0.5">RM</span>
      <span className="text-3xl font-extrabold text-[#003366] dark:text-blue-300 leading-none">
        {listing.price.toFixed(2)}
      </span>
      {suffix && <span className="text-sm text-gray-400 dark:text-slate-500 font-medium">{suffix}</span>}
    </div>
  );
}

export default function ShopListingDetailPage() {
  const [, params] = useRoute("/shop-listing/:listingId");
  const [, navigate] = useLocation();
  const { user, userProfile } = useAuth();
  const listingId = params?.listingId ?? "";

  const [listing, setListing] = useState<ShopListing | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const [deletingListing, setDeletingListing] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdModalAction, setHoldModalAction] = useState<"delete" | "edit">("delete");
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showOverflowMenu) return;
    function handleClick(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showOverflowMenu]);

  useEffect(() => {
    if (!listingId) return;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDoc(doc(db, "shopListings", listingId));
        if (!snap.exists()) {
          setLoading(false);
          return;
        }
        const l = { id: snap.id, ...snap.data() } as ShopListing;
        setListing(l);
        const s = await getShopById(l.shopId);
        setShop(s);
        incrementShopListingView(listingId, l.shopId, user?.uid).catch(() => {});
      } catch (err) {
        console.error("[ShopListingDetailPage] load error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [listingId]);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-[#003366] dark:text-blue-400" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Package size={40} className="mx-auto text-gray-300 dark:text-slate-600 mb-3" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">
          Listing not found
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          This listing may have been removed.
        </p>
        <Link href="/" className="text-[#003366] dark:text-blue-400 underline text-sm">
          Go home
        </Link>
      </div>
    );
  }

  const isOwner = user?.uid === shop?.ownerId;
  const isEditor = shop?.editorIds.includes(user?.uid ?? "") ?? false;
  const canManage = isOwner || isEditor;
  const photos = listing.photos ?? [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-24 lg:pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 lg:pt-8 pb-8">

        {/* Top bar: back + overflow */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => {
              if (window.history.length > 1) window.history.back();
              else navigate("/campus-market");
            }}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div className="relative" ref={overflowRef}>
            <button
              onClick={() => {
                if (!user) { setShowAuth(true); return; }
                setShowOverflowMenu((v) => !v);
              }}
              className="p-2 rounded-full text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              aria-label="More options"
            >
              <MoreHorizontal size={18} />
            </button>
            {showOverflowMenu && !canManage && (
              <div className="absolute right-0 top-full mt-1 min-w-[180px] bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 overflow-hidden">
                <button
                  onClick={() => { setShowOverflowMenu(false); setShowReport(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left min-h-[44px]"
                >
                  <Flag size={15} /> Report this listing
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start">

          {/* ── LEFT: Image Gallery ─────────────────────────────────── */}
          <div>
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm aspect-square sm:aspect-[4/3]">
              {photos.length > 0 ? (
                <img src={photos[photoIdx]} alt={listing.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={72} className="text-gray-200 dark:text-slate-700" />
                </div>
              )}

              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setPhotoIdx((i) => Math.max(0, i - 1))}
                    disabled={photoIdx === 0}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-gray-700 dark:text-slate-200 rounded-full p-2 shadow-md disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setPhotoIdx((i) => Math.min(photos.length - 1, i + 1))}
                    disabled={photoIdx === photos.length - 1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-gray-700 dark:text-slate-200 rounded-full p-2 shadow-md disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPhotoIdx(i)}
                        className={`rounded-full transition-all ${i === photoIdx ? "bg-[#003366] dark:bg-blue-400 w-5 h-1.5" : "bg-black/25 dark:bg-white/30 w-1.5 h-1.5 hover:bg-black/40"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {photos.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {photos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIdx(i)}
                    className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${i === photoIdx ? "border-[#003366] dark:border-blue-400 opacity-100" : "border-transparent opacity-60 hover:opacity-90"}`}
                  >
                    <img src={p} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: Action Panel ─────────────────────────────────── */}
          <div className="mt-5 lg:mt-0 lg:sticky lg:top-[72px]">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 space-y-5">

              {/* Category badge */}
              <span className="inline-flex items-center text-xs font-semibold bg-[#003366]/10 dark:bg-blue-900/30 text-[#003366] dark:text-blue-400 px-3 py-1 rounded-full">
                {listing.category}
              </span>

              {/* Title */}
              <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-slate-100 leading-snug -mt-1">
                {listing.title}
              </h1>

              {/* Price */}
              <div className="pb-5 border-b border-gray-100 dark:border-slate-800">
                <PriceLabel listing={listing} />
              </div>

              {/* Description */}
              {listing.description && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Description</p>
                  <p className={`text-sm text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap ${!descExpanded && listing.description.length > 200 ? "line-clamp-4" : ""}`}>
                    {listing.description}
                  </p>
                  {listing.description.length > 200 && (
                    <button
                      onClick={() => setDescExpanded((v) => !v)}
                      className="mt-2 text-xs font-semibold text-[#003366] dark:text-blue-400 hover:opacity-75 transition-opacity"
                    >
                      {descExpanded ? "Read less ↑" : "Read more ↓"}
                    </button>
                  )}
                </div>
              )}

              {/* Shop info */}
              {shop && (
                <div className="flex items-center gap-3 pt-1 border-t border-gray-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {shop.logoUrl ? (
                      <img src={shop.logoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Store size={18} className="text-[#003366] dark:text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{shop.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">@{(shop.ownerEmail ?? "").split("@")[0]}</p>
                  </div>
                  <Link
                    href={`/shop/${shop.slug}`}
                    className="shrink-0 text-xs font-semibold text-[#003366] dark:text-blue-400 border border-[#003366]/25 dark:border-blue-400/30 px-3 py-1.5 rounded-lg hover:bg-[#003366]/5 dark:hover:bg-blue-400/10 transition"
                  >
                    Visit →
                  </Link>
                </div>
              )}

              {/* Contact buttons — signed-in users only */}
              {user && shop && (shop.whatsapp || shop.wechat || shop.instagram) && (
                <div className="space-y-2.5 pt-1 border-t border-gray-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Contact Seller</p>
                  {shop.whatsapp && (
                    <a
                      href={`https://wa.me/${shop.whatsapp.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full min-h-[46px] bg-[#25D366] text-white font-semibold text-sm rounded-full hover:bg-[#1fba58] active:scale-[0.98] transition-all shadow-sm"
                    >
                      <SiWhatsapp size={16} /> WhatsApp
                    </a>
                  )}
                  {shop.wechat && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(shop.wechat!); alert(`WeChat ID copied: ${shop.wechat}`); }}
                      className="flex items-center justify-center gap-2 w-full min-h-[46px] bg-[#07C160] text-white font-semibold text-sm rounded-full hover:bg-[#06a852] active:scale-[0.98] transition-all shadow-sm"
                    >
                      <SiWechat size={16} /> WeChat: {shop.wechat}
                    </button>
                  )}
                  {shop.instagram && (
                    <a
                      href={`https://instagram.com/${shop.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full min-h-[46px] bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-semibold text-sm rounded-full hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
                    >
                      <SiInstagram size={16} /> @{shop.instagram}
                    </a>
                  )}
                </div>
              )}

              {/* Sign-in prompt */}
              {!user && shop && (shop.whatsapp || shop.wechat || shop.instagram) && (
                <p className="text-xs text-center text-gray-500 dark:text-slate-400 pt-1 border-t border-gray-100 dark:border-slate-800">
                  <button onClick={() => setShowAuth(true)} className="text-[#003366] dark:text-blue-400 font-semibold underline underline-offset-2">
                    Sign in
                  </button>{" "}to see seller contact details
                </p>
              )}

              {/* Chat CTA — desktop (hidden on mobile, shown in sticky bar) */}
              {!canManage && (
                <div className="hidden lg:block pt-1">
                  {user ? (
                    <button
                      onClick={async () => {
                        if (!listing || !shop) return;
                        try {
                          const convId = await getOrCreateConversation(
                            user.uid,
                            shop.ownerId,
                            { id: listing.id, title: listing.title, photos: listing.photos ?? [] },
                            { shopName: shop.name, shopOwnerUid: shop.ownerId },
                          );
                          navigate(`/messages?conv=${convId}`);
                        } catch (err) {
                          console.error("[ShopListingDetailPage] chat error:", err);
                        }
                      }}
                      className="w-full min-h-[52px] bg-[#003366] dark:bg-blue-600 text-white font-bold text-sm rounded-2xl hover:bg-[#002244] dark:hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.99]"
                    >
                      <MessageSquare size={17} /> Chat with Seller
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowAuth(true)}
                      className="w-full min-h-[52px] bg-[#003366] dark:bg-blue-600 text-white font-bold text-sm rounded-2xl hover:bg-[#002244] dark:hover:bg-blue-700 transition-all shadow-md"
                    >
                      Sign in to Chat
                    </button>
                  )}
                </div>
              )}

              {/* Manager notice + Edit/Delete */}
              {canManage && (
                <div className="space-y-3 pt-1 border-t border-gray-100 dark:border-slate-800">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400 text-center font-medium">
                    You manage this shop —{" "}
                    <Link href={`/shop/${shop?.slug}`} className="underline font-bold">
                      manage your shop
                    </Link>{" "}
                    to view inquiries.
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/shop/${shop?.slug}?editListing=${listing?.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!listing || !shop || !confirm("Remove this listing? This cannot be undone.")) return;
                        setDeletingListing(true);
                        try {
                          await deleteShopListing(listing.id, listing.shopId);
                          navigate(`/shop/${shop.slug}`);
                        } catch (err: any) {
                          if (err?.code === "report-hold") {
                            setHoldModalAction("delete");
                            setShowHoldModal(true);
                          } else {
                            console.error("[ShopListingDetailPage] delete error:", err);
                          }
                        } finally {
                          setDeletingListing(false);
                        }
                      }}
                      disabled={deletingListing}
                      className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 rounded-xl text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                    >
                      {deletingListing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Remove
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky chat bar */}
      {!canManage && (
        <div className="fixed bottom-14 lg:hidden left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-100 dark:border-slate-800 px-4 py-3 shadow-lg">
          {user ? (
            <button
              onClick={async () => {
                if (!listing || !shop) return;
                try {
                  const convId = await getOrCreateConversation(
                    user.uid,
                    shop.ownerId,
                    { id: listing.id, title: listing.title, photos: listing.photos ?? [] },
                    { shopName: shop.name, shopOwnerUid: shop.ownerId },
                  );
                  navigate(`/messages?conv=${convId}`);
                } catch (err) {
                  console.error("[ShopListingDetailPage] chat error:", err);
                }
              }}
              className="w-full min-h-[48px] bg-[#003366] dark:bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-[#002244] dark:hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <MessageSquare size={16} /> Chat with Seller
            </button>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="w-full min-h-[48px] bg-[#003366] dark:bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-[#002244] dark:hover:bg-blue-700 transition"
            >
              Sign in to Chat
            </button>
          )}
        </div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showReport && listing && (
        <ReportModal
          listing={{
            id: listing.id,
            title: listing.title,
            userId: listing.shopOwnerId,
            userEmail: shop?.ownerEmail ?? "",
            type: "shop-listing",
            description: listing.description,
            category: listing.category,
            condition: "new",
            photos: listing.photos,
            userName: listing.shopName,
            createdAt: listing.createdAt,
            isArchived: false,
          } as Listing}
          onClose={() => setShowReport(false)}
        />
      )}
      {showHoldModal && (
        <ReportHoldModal action={holdModalAction} onClose={() => setShowHoldModal(false)} />
      )}
    </div>
  );
}
