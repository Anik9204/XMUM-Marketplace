import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getShopById, createOrder } from "@/lib/shops";
import { Shop, ShopListing } from "@/lib/types";
import AuthModal from "@/components/AuthModal";
import {
  ArrowLeft, Package, Store, Loader2, CheckCircle2,
} from "lucide-react";
import { SiWhatsapp, SiWechat } from "react-icons/si";

const inputCls =
  "w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#003366] dark:focus:ring-blue-500 transition";

export default function OrderFormPage() {
  const [, params] = useRoute("/order/:listingId");
  const [, navigate] = useLocation();
  const { user, userProfile } = useAuth();
  const listingId = params?.listingId ?? "";

  const [listing, setListing] = useState<ShopListing | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [offeredPrice, setOfferedPrice] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!listingId) return;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDoc(doc(db, "shopListings", listingId));
        if (!snap.exists()) { setLoading(false); return; }
        const l = { id: snap.id, ...snap.data() } as ShopListing;
        setListing(l);
        const s = await getShopById(l.shopId);
        setShop(s);
      } catch (err) {
        console.error("[OrderFormPage] load error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [listingId]);

  useEffect(() => {
    if (!loading && !user) setShowAuth(true);
  }, [loading, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile || !listing || !shop) return;
    setError("");

    const questions = shop.orderQuestions ?? [];
    for (const q of questions) {
      if (q.required && !answers[q.id]?.trim()) {
        setError(`Please fill in: "${q.label}"`);
        return;
      }
    }

    if (listing.pricingModel === "negotiable" && !offeredPrice) {
      setError("Please enter your offered price.");
      return;
    }

    setSubmitting(true);
    try {
      const buyerName =
        userProfile.fullName || userProfile.displayName || user.email || "Anonymous";

      await createOrder({
        shopId: shop.id,
        shopName: shop.name,
        shopListingId: listing.id,
        listingTitle: listing.title,
        buyerId: user.uid,
        buyerName,
        buyerEmail: user.email ?? "",
        buyerWhatsapp: userProfile.whatsapp ?? null,
        buyerWechat: userProfile.wechat ?? null,
        quantity,
        offeredPrice: listing.pricingModel === "negotiable" && offeredPrice
          ? parseFloat(offeredPrice)
          : null,
        answers,
      });

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to place order. Please try again.");
    } finally {
      setSubmitting(false);
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

  if (canManage) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Store size={40} className="mx-auto text-amber-400 mb-3" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
          You manage this shop
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
          You can't order from your own shop.
        </p>
        <button
          onClick={() => navigate(`/shop-listing/${listing.id}`)}
          className="flex items-center gap-2 mx-auto text-sm font-semibold text-[#003366] dark:text-blue-400 hover:underline"
        >
          <ArrowLeft size={15} /> Back to listing
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          Order placed!
        </h2>
        <p className="text-sm text-gray-600 dark:text-slate-300 mb-6">
          The shop will review and confirm your order. You'll get a notification when confirmed.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={() => navigate(`/shop/${shop?.slug}`)}
            className="bg-[#003366] dark:bg-blue-600 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#002244] transition"
          >
            Back to shop
          </button>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-gray-500 dark:text-slate-400 hover:underline"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-100 dark:border-slate-800">
        <button
          onClick={() => navigate(`/shop-listing/${listing.id}`)}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition"
        >
          <ArrowLeft size={18} className="text-gray-700 dark:text-slate-300" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-900 dark:text-slate-100 truncate">
            Place Order
          </h1>
          <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
            {listing.title}
          </p>
        </div>
      </div>

      {/* Listing summary strip */}
      <div className="mx-4 mt-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-3 flex items-center gap-3">
        {listing.photos[0] ? (
          <img
            src={listing.photos[0]}
            alt=""
            className="w-14 h-14 rounded-xl object-cover shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <Package size={22} className="text-gray-300 dark:text-slate-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 line-clamp-1">
            {listing.title}
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
            {shop?.name}
          </p>
          <p className="text-xs font-bold text-[#003366] dark:text-blue-300 mt-0.5">
            {listing.pricingModel === "negotiable"
              ? "Negotiable"
              : listing.price !== undefined
              ? `RM ${listing.price.toFixed(2)}${listing.pricingModel && listing.pricingModel !== "fixed" ? ` / ${listing.pricingModel.replace("_", " ")}` : ""}`
              : ""}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-4 mt-5 space-y-5">
        {/* Quantity */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
            Quantity <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            required
            className={inputCls}
          />
        </div>

        {/* Offered price — negotiable only */}
        {listing.pricingModel === "negotiable" && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              Your offered price (RM) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 dark:text-slate-400 pointer-events-none">
                RM
              </span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={offeredPrice}
                onChange={(e) => setOfferedPrice(e.target.value)}
                placeholder="0.00"
                className={`${inputCls} pl-10`}
              />
            </div>
          </div>
        )}

        {/* Custom order questions */}
        {(shop?.orderQuestions ?? []).map((q) => (
          <div key={q.id}>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              {q.label}
              {q.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {q.type === "textarea" ? (
              <textarea
                rows={3}
                required={q.required}
                value={answers[q.id] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                className={`${inputCls} resize-none`}
              />
            ) : (
              <input
                type={q.type}
                required={q.required}
                value={answers[q.id] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                className={inputCls}
              />
            )}
          </div>
        ))}

        {/* Contact info (read-only) */}
        {(userProfile?.whatsapp || userProfile?.wechat) && (
          <div className="bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">
              Contact info shared with shop
            </p>
            {userProfile.whatsapp && (
              <div className="flex items-center gap-2 mb-1.5">
                <SiWhatsapp size={13} className="text-green-500 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-slate-300">
                  {userProfile.whatsapp}
                </span>
              </div>
            )}
            {userProfile.wechat && (
              <div className="flex items-center gap-2">
                <SiWechat size={13} className="text-[#07C160] shrink-0" />
                <span className="text-sm text-gray-700 dark:text-slate-300">
                  {userProfile.wechat}
                </span>
              </div>
            )}
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2">
              This contact info will be shared with the shop.{" "}
              <Link href="/settings" className="underline">
                Update in Settings
              </Link>
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 font-medium">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || !user}
          className="w-full min-h-[52px] bg-[#003366] dark:bg-blue-600 text-white font-bold text-sm rounded-2xl hover:bg-[#002244] dark:hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-md"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Placing order…
            </>
          ) : (
            "Place Order"
          )}
        </button>
      </form>

      {showAuth && (
        <AuthModal
          onClose={() => {
            if (!user) navigate(`/shop-listing/${listing.id}`);
            setShowAuth(false);
          }}
        />
      )}
    </div>
  );
}
