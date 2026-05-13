import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getShopById, incrementShopListingView, createInquiry, deleteShopListing } from "@/lib/shops";
import { Shop, ShopListing } from "@/lib/types";
import AuthModal from "@/components/AuthModal";
import ReportModal from "@/components/ReportModal";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Package,
  Loader2, Store, Send, Edit2, Trash2, MoreHorizontal, Flag,
} from "lucide-react";
import { SiWhatsapp, SiWechat } from "react-icons/si";

function PriceLabel({ listing }: { listing: ShopListing }) {
  if (listing.pricingModel === "negotiable")
    return <span className="text-lg font-bold text-blue-600 dark:text-blue-400">Negotiable</span>;
  if (listing.price === undefined) return null;
  const suffix =
    listing.pricingModel && listing.pricingModel !== "fixed"
      ? ` / ${listing.pricingModel.replace("_", " ")}`
      : "";
  return (
    <span className="text-lg font-bold text-[#003366] dark:text-blue-300">
      RM {listing.price.toFixed(2)}{suffix}
    </span>
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

  const [showInquiry, setShowInquiry] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [inquiryError, setInquiryError] = useState("");
  const [deletingListing, setDeletingListing] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
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
        incrementShopListingView(listingId, l.shopId).catch(() => {});
      } catch (err) {
        console.error("[ShopListingDetailPage] load error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [listingId]);

  const handleInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) {
      setShowAuth(true);
      return;
    }
    if (!listing || !shop) return;
    setInquiryError("");
    setSending(true);
    try {
      await createInquiry({
        shopId: shop.id,
        shopName: shop.name,
        shopListingId: listing.id,
        listingTitle: listing.title,
        buyerId: user.uid,
        buyerName:
          userProfile.fullName || userProfile.displayName || user.email || "Anonymous",
        buyerEmail: user.email ?? "",
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
    <div className="max-w-2xl mx-auto pb-48 md:pb-36">
      {/* Photo gallery */}
      <div className="relative bg-gray-100 dark:bg-slate-800 aspect-square sm:aspect-video overflow-hidden sm:max-h-[480px]">
        {photos.length > 0 ? (
          <img src={photos[photoIdx]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={64} className="text-gray-300 dark:text-slate-600" />
          </div>
        )}

        <button
          onClick={() => window.history.back()}
          className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm text-white p-2.5 rounded-full hover:bg-black/60 transition shadow-lg"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Overflow menu — three-dot button at top-right */}
        <div className="absolute top-4 right-4" ref={overflowRef}>
          <button
            onClick={() => {
              if (!user) { setShowAuth(true); return; }
              setShowOverflowMenu((v) => !v);
            }}
            className="bg-black/40 backdrop-blur-sm text-white p-2.5 rounded-full hover:bg-black/60 transition shadow-lg"
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
                <Flag size={15} />
                Report this listing
              </button>
            </div>
          )}
        </div>

        {photos.length > 1 && (
          <>
            <button
              onClick={() => setPhotoIdx((i) => Math.max(0, i - 1))}
              disabled={photoIdx === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 disabled:opacity-30 hover:bg-black/60 transition"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setPhotoIdx((i) => Math.min(photos.length - 1, i + 1))}
              disabled={photoIdx === photos.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 disabled:opacity-30 hover:bg-black/60 transition"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPhotoIdx(i)}
                  className={`rounded-full transition-all ${
                    i === photoIdx ? "bg-white w-4 h-1.5" : "bg-white/50 w-1.5 h-1.5"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Title + price + category */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-tight mb-2">
            {listing.title}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <PriceLabel listing={listing} />
            <span className="text-xs bg-[#003366]/10 dark:bg-blue-900/30 text-[#003366] dark:text-blue-400 font-semibold px-2.5 py-1 rounded-full">
              {listing.category}
            </span>
          </div>
        </div>

        {/* Description */}
        {listing.description && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
              Description
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {listing.description}
            </p>
          </div>
        )}

        {/* Shop info card */}
        {shop && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
              {shop.logoUrl ? (
                <img src={shop.logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Store size={22} className="text-[#003366] dark:text-blue-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">
                {shop.name}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Created by @{(shop.ownerEmail ?? "").split("@")[0] || shop.name}
              </p>
            </div>
            <Link
              href={`/shop/${shop.slug}`}
              className="shrink-0 text-xs font-semibold text-[#003366] dark:text-blue-400 border border-[#003366]/30 dark:border-blue-400/30 px-3 py-1.5 rounded-lg hover:bg-[#003366]/5 transition"
            >
              View Shop →
            </Link>
          </div>
        )}

        {/* Contact buttons */}
        {shop && (shop.whatsapp || shop.wechat) && (
          <div className="flex flex-wrap gap-2">
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

        {/* Manager notice + Edit/Delete */}
        {canManage && (
          <div className="space-y-3">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400 text-center font-medium">
              You manage this shop —{" "}
              <Link
                href={`/shop/${shop?.slug}`}
                className="underline font-bold"
              >
                manage your shop
              </Link>{" "}
              to view inquiries.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/shop/${shop?.slug}`)}
                className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Edit2 size={14} /> Edit Listing
              </button>
              <button
                onClick={async () => {
                  if (!listing || !shop || !confirm("Remove this listing? This cannot be undone.")) return;
                  setDeletingListing(true);
                  try {
                    await deleteShopListing(listing.id, listing.shopId);
                    navigate(`/shop/${shop.slug}`);
                  } catch (err: any) {
                    console.error("[ShopListingDetailPage] delete error:", err);
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

        {/* Inquiry success */}
        {sent && (
          <>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-400 font-semibold text-center">
              ✅ Inquiry sent! The shop will contact you soon.
            </div>
            {shop?.autoReplyEnabled && shop.autoReplyMessage && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
                <p className="font-semibold text-xs mb-1">
                  Automated reply from {shop.name}:
                </p>
                <p>{shop.autoReplyMessage}</p>
              </div>
            )}
          </>
        )}

        {/* Inline inquiry form */}
        {showInquiry && !canManage && (
          <form
            onSubmit={handleInquiry}
            className="space-y-3 bg-blue-50 dark:bg-slate-800 rounded-xl p-4"
          >
            <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
              Send Inquiry
            </h3>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Message (optional)
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ask anything about this listing before ordering…"
                className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
              />
            </div>
            {inquiryError && <p className="text-xs text-red-500">{inquiryError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={sending}
                className="flex-1 bg-[#003366] dark:bg-blue-600 text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-[#002244] disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send size={13} /> Send
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowInquiry(false)}
                className="px-4 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 font-semibold text-sm rounded-xl hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Sticky action bar */}
      {!canManage && !sent && !showInquiry && (
        <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700 px-4 py-3 shadow-lg">
          <button
            onClick={() => {
              if (!user) {
                setShowAuth(true);
              } else {
                setShowInquiry(true);
              }
            }}
            className="w-full min-h-[48px] bg-[#003366] dark:bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-[#002244] transition"
          >
            Send Inquiry
          </button>
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
    </div>
  );
}
