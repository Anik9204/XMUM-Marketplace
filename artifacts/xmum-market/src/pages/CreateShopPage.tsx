import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { createShop, slugify, isSlugAvailable, uploadShopBanner, uploadShopLogo, updateShop } from "@/lib/shops";
import { moderateContent } from "@/lib/aiModerate";
import { writeAiFlag } from "@/lib/aiFlag";
import { ShopCategory } from "@/lib/types";
import AuthModal from "@/components/AuthModal";
import { Store, CheckCircle2, XCircle, Loader2, AlertCircle, Edit2, ImagePlus, X } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import { stripRichText } from "@/lib/richText";

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

interface BioEditorModalProps {
  value: string;
  onChange: (val: string) => void;
  onClose: () => void;
}

function BioEditorModal({ value, onChange, onClose }: BioEditorModalProps) {
  const [draft, setDraft] = useState(value);
  const handleSave = () => { onChange(draft); onClose(); };
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
          Bio / Description
        </h2>
        <button
          type="button"
          onClick={handleSave}
          className="text-sm font-semibold text-[#003366] dark:text-blue-400 hover:opacity-75 transition-opacity"
        >
          Done
        </button>
      </div>
      <div className="flex flex-col flex-1 px-4 py-3 overflow-hidden">
        <RichTextEditor
          autoFocus
          value={draft}
          onChange={setDraft}
          placeholder="Describe your shop — what you sell, how to order, operating hours, policies..."
          maxLength={3500}
          className="flex-1"
        />
        <div className={`text-right text-xs mt-2 font-medium ${stripRichText(draft).length > 2700 ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-slate-500"}`}>
          {stripRichText(draft).length} / 3000
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#003366]/30 dark:focus:ring-blue-400/30 focus:border-[#003366] dark:focus:border-blue-400 transition min-h-[44px] shadow-sm";

const selectCls =
  "w-full bg-white text-gray-900 border border-gray-200 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-[#003366]/30 dark:focus:ring-blue-400/30 focus:border-[#003366] dark:focus:border-blue-400 transition min-h-[44px] shadow-sm";

const labelCls = "block text-sm font-display font-semibold text-gray-700 dark:text-slate-300 mb-1";

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
  const [showBioEditor, setShowBioEditor] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [wechat, setWechat] = useState("");
  const [instagram, setInstagram] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [createdShopId, setCreatedShopId] = useState("");

  // Image upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string>("");
  const [bannerError, setBannerError] = useState<string>("");
  const [logoError, setLogoError] = useState<string>("");

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

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

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⏳</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          Shop submitted for approval
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
          Your shop has been submitted and is waiting for admin approval.
          You'll receive a notification once it's reviewed — usually within 24 hours.
        </p>
        <button
          onClick={() => navigate(`/shop-dashboard/${createdShopId}`)}
          className="text-sm text-[#003366] dark:text-blue-400 underline underline-offset-2"
        >
          Go to your shop dashboard
        </button>
      </div>
    );
  }

  const handleSlugChange = (val: string) => {
    setSlugManual(true);
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40));
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setBannerError("Banner must be under 3MB");
      return;
    }
    setBannerError("");
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Logo must be under 2MB");
      return;
    }
    setLogoError("");
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Shop name is required."); return; }
    if (!slug) { setError("URL slug is required."); return; }
    if (slugAvailable === false) { setError("That slug is already taken. Choose another."); return; }
    if (!user?.email) { setError("You must be signed in with an XMUM email."); return; }
    if (!whatsapp.trim() && !wechat.trim()) {
      setError("Please provide at least one contact method — WhatsApp or WeChat.");
      return;
    }

    // AI moderation on shop name + bio
    const shopContent = `Shop name: ${name}\nBio: ${bio}`;
    const aiResult = await moderateContent(shopContent, "shop-profile", []);
    if (aiResult.result === "BLOCKED") {
      setError(aiResult.suggestion ? `${aiResult.reason} ${aiResult.suggestion}` : (aiResult.reason || "Shop content flagged. Please review and try again."));
      return;
    }
    if (aiResult.result === "FLAGGED") {
      void writeAiFlag({
        context: "shop-profile",
        reason: aiResult.reason,
        content: `Shop name: ${name}\nBio: ${bio}`,
        shopName: name,
        userId: user?.uid ?? "",
        userEmail: user?.email ?? "",
        createdAt: Date.now(),
        status: "pending",
      });
    }
    setLoading(true);
    try {
      const shopId = await createShop(user.uid, user.email, {
        name,
        slug,
        bio,
        category,
        whatsapp,
        wechat,
        instagram,
      });
      // Upload logo/banner after creation — failure is non-blocking
      try {
        const updates: Record<string, string> = {};
        if (logoFile) {
          const logoUrl = await uploadShopLogo(shopId, logoFile);
          updates.logoUrl = logoUrl;
        }
        if (bannerFile) {
          const bannerUrl = await uploadShopBanner(shopId, bannerFile);
          updates.bannerUrl = bannerUrl;
        }
        if (Object.keys(updates).length > 0) {
          await updateShop(shopId, updates);
        }
      } catch {
        // Upload failed — shop created successfully, owner can upload images later
      }
      setSubmitted(true);
      setCreatedShopId(shopId);
    } catch (err: any) {
      setError(err.message ?? "Failed to create shop. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-8">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#003366] flex items-center justify-center">
          <Store size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Create a Shop</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400">Your own storefront on Campus Market</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-start gap-2 mb-4">
            <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Desktop two-column layout */}
        <div className="md:grid md:grid-cols-[280px_1fr] md:gap-8 md:items-start">

          {/* LEFT COLUMN — sticky preview sidebar (desktop only) */}
          <div className="hidden md:block">
            <div className="sticky top-20 space-y-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-sm">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-3">Shop Setup</p>
                <div className="space-y-2">
                  {/* Shop name live preview */}
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏪</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">
                      {name || "Your shop name"}
                    </span>
                  </div>
                  {/* Slug preview */}
                  <p className="text-xs font-mono text-[#003366] dark:text-blue-400 truncate pl-7">
                    xmummarket.com/shop/{slug || "your-slug"}
                  </p>
                  {/* Category badge */}
                  {category && (
                    <div className="pl-7">
                      <span className="inline-block text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-[#003366] dark:text-blue-300 px-2 py-0.5 rounded-full">
                        {category}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — all form sections */}
          <div className="space-y-4">

            {/* Section 1 — Shop Images */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#003366] dark:bg-blue-600 text-white text-xs font-bold shrink-0">1</span>
                <h2 className="text-sm font-bold text-gray-800 dark:text-slate-200">Shop Images</h2>
                <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">Optional</span>
              </div>
              <div className="space-y-4">
                {/* Banner upload */}
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className={labelCls}>Shop Banner</label>
                    <span className="text-xs text-gray-400 dark:text-slate-500">Recommended: 1200×400px · Max 3MB</span>
                  </div>
                  <div
                    className="w-full h-32 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-600 overflow-hidden relative cursor-pointer group"
                    onClick={() => bannerInputRef.current?.click()}
                  >
                    {bannerPreview ? (
                      <>
                        <img src={bannerPreview} alt="Banner preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setBannerFile(null); setBannerPreview(""); }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-1.5 text-gray-400 dark:text-slate-500">
                        <ImagePlus size={22} />
                        <span className="text-xs font-medium">Click to upload banner</span>
                      </div>
                    )}
                  </div>
                  {bannerError && <p className="text-xs text-red-500 mt-1">{bannerError}</p>}
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBannerChange}
                  />
                </div>

                {/* Logo upload */}
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className={labelCls}>Shop Logo</label>
                    <span className="text-xs text-gray-400 dark:text-slate-500">Square · Max 2MB</span>
                  </div>
                  <div
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-600 overflow-hidden relative cursor-pointer group"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {logoPreview ? (
                      <>
                        <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setLogoFile(null); setLogoPreview(""); }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-1 text-gray-400 dark:text-slate-500">
                        <ImagePlus size={18} />
                        <span className="text-[10px] font-medium">Logo</span>
                      </div>
                    )}
                  </div>
                  {logoError && <p className="text-xs text-red-500 mt-1">{logoError}</p>}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </div>
              </div>
            </div>

            {/* Section 2 — Shop Identity */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#003366] dark:bg-blue-600 text-white text-xs font-bold shrink-0">2</span>
                <h2 className="text-sm font-bold text-gray-800 dark:text-slate-200">Shop Identity</h2>
              </div>
              <div className="space-y-4">
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
                    className={selectCls}
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ShopCategory)}
                  >
                    {SHOP_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3 — Bio / Description */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#003366] dark:bg-blue-600 text-white text-xs font-bold shrink-0">3</span>
                <h2 className="text-sm font-bold text-gray-800 dark:text-slate-200">Bio / Description</h2>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowBioEditor(true)}
                  className={`w-full text-left border rounded-xl px-3 py-2.5 text-sm min-h-[80px] bg-white dark:bg-slate-700 ${
                    bio ? "text-gray-900 dark:text-slate-100" : "text-gray-400 dark:text-slate-500"
                  } border-gray-200 dark:border-slate-600`}
                >
                  {bio ? (
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-3 leading-relaxed whitespace-pre-wrap">{bio}</span>
                      <Edit2 size={14} className="text-gray-400 dark:text-slate-500 shrink-0 mt-0.5" />
                    </div>
                  ) : (
                    <span>Describe your shop — what you sell, how to order, operating hours, policies...</span>
                  )}
                </button>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    Describe your shop's purpose, ordering process, and any important details.
                  </p>
                  {bio && (
                    <p className={`text-xs font-semibold tabular-nums ${bio.length > 2700 ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-slate-500"}`}>
                      {bio.length} / 3000
                    </p>
                  )}
                </div>
                {showBioEditor && (
                  <BioEditorModal
                    value={bio}
                    onChange={setBio}
                    onClose={() => setShowBioEditor(false)}
                  />
                )}
              </div>
            </div>

            {/* Section 4 — Contact */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#003366] dark:bg-blue-600 text-white text-xs font-bold shrink-0">4</span>
                <h2 className="text-sm font-bold text-gray-800 dark:text-slate-200">Contact</h2>
              </div>
              <div className="space-y-4">
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

                <div>
                  <label className={labelCls}>Instagram (optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-slate-500 select-none">@</span>
                    <input
                      className={`${inputCls} pl-7`}
                      placeholder="your_instagram_handle"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value.replace(/^@/, ""))}
                    />
                  </div>
                </div>

                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ At least one of WhatsApp or WeChat is required so customers can reach you.
                </p>
              </div>
            </div>

            {/* Submit button */}
            <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700 px-4 pt-3 pb-4 -mx-4 md:static md:bg-transparent md:border-0 md:p-0 md:mt-2">
              <button
                type="submit"
                disabled={loading || slugAvailable === false || slugChecking}
                className="w-full min-h-[52px] bg-[#003366] dark:bg-blue-600 text-white font-semibold text-base rounded-xl hover:bg-[#002244] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Creating…</> : "Create Shop"}
              </button>
            </div>

          </div>{/* end right column */}
        </div>{/* end two-column grid */}
      </form>
    </div>
  );
}
