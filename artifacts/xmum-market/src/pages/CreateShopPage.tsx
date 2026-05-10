import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { createShop, slugify, isSlugAvailable } from "@/lib/shops";
import { ShopCategory } from "@/lib/types";
import AuthModal from "@/components/AuthModal";
import { Store, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";

const SHOP_CATEGORIES: ShopCategory[] = [
  "Food & Beverage",
  "Tutoring & Education",
  "Fashion & Apparel",
  "Electronics",
  "Beauty & Wellness",
  "Transport & Rental",
  "Handmade & Custom",
  "Books & Stationery",
  "Services",
  "Travel & Lifestyle",
  "Others",
];

const inputCls =
  "w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition min-h-[44px]";
const labelCls = "block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1";

export default function CreateShopPage() {
  const { user, userProfile } = useAuth();
  const [, navigate] = useLocation();
  const [showAuth, setShowAuth] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [category, setCategory] = useState<ShopCategory>("Others");
  const [bio, setBio] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [wechat, setWechat] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slugManual && name) {
      setSlug(slugify(name));
    }
  }, [name, slugManual]);

  useEffect(() => {
    if (!slug) { setSlugAvailable(null); return; }
    setSlugChecking(true);
    setSlugAvailable(null);
    const timer = setTimeout(async () => {
      try {
        const avail = await isSlugAvailable(slug);
        setSlugAvailable(avail);
      } catch {
        setSlugAvailable(null);
      } finally {
        setSlugChecking(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [slug]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Store size={48} className="mx-auto text-gray-300 dark:text-slate-600 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">Sign in to create a shop</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">You need an @xmu.edu.my account to open a Campus Market shop.</p>
        <button
          onClick={() => setShowAuth(true)}
          className="bg-[#003366] text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#002244] transition"
        >
          Sign In
        </button>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  const handleSlugChange = (val: string) => {
    setSlugManual(true);
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Shop name is required."); return; }
    if (!slug) { setError("URL slug is required."); return; }
    if (slugAvailable === false) { setError("That slug is already taken. Choose another."); return; }
    if (!user?.email) { setError("You must be signed in with an XMUM email."); return; }

    setLoading(true);
    try {
      const shopId = await createShop(user.uid, user.email, {
        name,
        slug,
        bio,
        category,
        whatsapp,
        wechat,
      });
      navigate(`/shop-dashboard/${shopId}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to create shop. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#003366] flex items-center justify-center">
          <Store size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Create a Shop</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400">Your own storefront on Campus Market</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <div>
          <label className={labelCls}>Shop Name <span className="text-red-500">*</span></label>
          <input
            className={inputCls}
            maxLength={60}
            placeholder="e.g. Mei's Kitchen, TechFix XMUM"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{name.length}/60</p>
        </div>

        <div>
          <label className={labelCls}>Shop URL <span className="text-red-500">*</span></label>
          <div className="relative">
            <input
              className={`${inputCls} pr-8`}
              placeholder="my-shop-name"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {slugChecking && <Loader2 size={14} className="animate-spin text-gray-400" />}
              {!slugChecking && slugAvailable === true && <CheckCircle2 size={14} className="text-green-500" />}
              {!slugChecking && slugAvailable === false && <XCircle size={14} className="text-red-500" />}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Preview:{" "}
            <span className="font-mono text-[#003366] dark:text-blue-400">
              campusmarket.app/shop/{slug || "your-slug"}
            </span>
          </p>
          {slugAvailable === false && (
            <p className="text-xs text-red-500 mt-0.5">This slug is already taken.</p>
          )}
          {slugAvailable === true && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Slug is available!</p>
          )}
        </div>

        <div>
          <label className={labelCls}>Category <span className="text-red-500">*</span></label>
          <select
            className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-h-[44px]"
            value={category}
            onChange={(e) => setCategory(e.target.value as ShopCategory)}
          >
            {SHOP_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Bio / Description</label>
          <textarea
            className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
            rows={3}
            maxLength={300}
            placeholder="Tell customers what your shop is about..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{bio.length}/300</p>
        </div>

        <div>
          <label className={labelCls}>WhatsApp (optional)</label>
          <input
            className={inputCls}
            placeholder="+60123456789"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>WeChat ID (optional)</label>
          <input
            className={inputCls}
            placeholder="your_wechat_id"
            value={wechat}
            onChange={(e) => setWechat(e.target.value)}
          />
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700 px-4 pt-3 pb-4 -mx-4 md:static md:bg-transparent md:border-0 md:p-0 md:mt-2">
          <button
            type="submit"
            disabled={loading || slugAvailable === false || slugChecking}
            className="w-full min-h-[52px] bg-[#003366] dark:bg-blue-600 text-white font-semibold text-base rounded-xl hover:bg-[#002244] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow"
          >
            {loading ? <><Loader2 size={18} className="animate-spin" /> Creating…</> : "Create Shop"}
          </button>
        </div>
      </form>
    </div>
  );
}
