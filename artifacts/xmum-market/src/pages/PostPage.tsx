import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { uploadPhoto, createListing } from "@/lib/listings";
import { auth } from "@/lib/firebase";
import { ListingType, Condition } from "@/lib/types";
import AuthModal from "@/components/AuthModal";
import { ImagePlus, X, AlertCircle, CheckCircle2 } from "lucide-react";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB — matches Firebase Storage security rule

const BUY_SELL_CATEGORIES = [
  "electronics", "books", "clothing", "furniture", "food", "services", "others",
];
const LOST_FOUND_CATEGORIES = ["lostItem", "foundItem"];

const inputCls =
  "w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition min-h-[44px]";

const selectCls =
  "w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition min-h-[44px]";

const labelCls = "block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1";

function SuccessToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const hide = setTimeout(() => setVisible(false), 3000);
    const done = setTimeout(onDone, 3400);
    return () => { clearTimeout(hide); clearTimeout(done); };
  }, [onDone]);
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#003366] dark:bg-blue-700 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl transition-all duration-400 ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"}`}>
      <CheckCircle2 size={18} className="text-green-300 shrink-0" />
      {message}
    </div>
  );
}

export default function PostPage() {
  const { t } = useLang();
  const { user, userProfile } = useAuth();
  const [, navigate] = useLocation();

  const [type, setType] = useState<ListingType>("buy-sell");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("electronics");
  const [condition, setCondition] = useState<Condition>("used");
  const [whatsapp, setWhatsapp] = useState("");
  const [wechat, setWechat] = useState("");
  const [teams, setTeams] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.whatsapp) setWhatsapp(userProfile.whatsapp);
    if (userProfile.wechat) setWechat(userProfile.wechat);
  }, [userProfile]);

  // Re-run on type change so the field is populated when switching tabs
  useEffect(() => {
    if (user?.email) setTeams(user.email);
  }, [user, type]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <AlertCircle size={40} className="text-gray-300 dark:text-slate-600 mb-3" />
        <p className="text-gray-600 dark:text-slate-300 font-medium mb-1">{t.loginToPost}</p>
        <button onClick={() => setShowAuth(true)} className="mt-3 bg-[#003366] dark:bg-blue-600 text-white px-5 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold">
          {t.signIn}
        </button>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  if (!user.emailVerified) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <AlertCircle size={40} className="text-amber-400 mb-3" />
        <p className="text-gray-600 dark:text-slate-300 font-medium">{t.verifyToPost}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-xs">{t.verifyEmailMsg}</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-xs text-[#003366] dark:text-blue-400 underline">
          I've verified my email — refresh
        </button>
      </div>
    );
  }

  const categories = type === "buy-sell" ? BUY_SELL_CATEGORIES : LOST_FOUND_CATEGORIES;

  function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout:${label}`)), ms)),
    ]);
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (photos.length + files.length > 3) { setError(t.uploadLimit); return; }
    const oversized = files.find((f) => f.size > MAX_FILE_BYTES);
    if (oversized) { setError(t.imageTooLarge); return; }
    setError("");
    setPhotos([...photos, ...files]);
    setPreviews([...previews, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removePhoto = (i: number) => {
    setPhotos(photos.filter((_, idx) => idx !== i));
    setPreviews(previews.filter((_, idx) => idx !== i));
  };

  const handleTypeChange = (newType: ListingType) => {
    setType(newType);
    setCategory(newType === "buy-sell" ? "electronics" : "lostItem");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await withTimeout(auth.currentUser?.getIdToken(true) ?? Promise.resolve(""), 10_000, "token-refresh");

      const urls: string[] = [];
      for (const f of photos) {
        try {
          const url = await withTimeout(uploadPhoto(f, user.uid), 30_000, "photo-upload");
          urls.push(url);
        } catch (photoErr: any) {
          console.warn("[PostPage] Photo skipped:", photoErr?.message);
        }
      }

      // Offline persistence is disabled — createListing either succeeds on the
      // server immediately or throws a real error. Never swallow this error.
      // price is omitted entirely for lost-found (Firestore rejects undefined values).
      const baseData = {
        type, title, description,
        category, condition, photos: urls,
        userId: user.uid, userEmail: user.email ?? "",
        userName: user.email?.split("@")[0] ?? "",
        whatsapp, wechat, teams,
      };
      const listingData = type === "buy-sell"
        ? { ...baseData, price: parseFloat(price) || 0 }
        : baseData;

      await withTimeout(createListing(listingData), 12_000, "create-listing");

      setToast("Your post has been successfully published.");
    } catch (err: any) {
      const code: string = err?.code ?? "";
      const msg: string = err?.message ?? "";
      if (msg.startsWith("timeout:token-refresh")) setError("Session refresh timed out. Please sign out and sign back in.");
      else if (msg.startsWith("timeout:photo-upload")) setError("A photo upload timed out. Try a smaller image or check your connection.");
      else if (msg.startsWith("timeout:create-listing")) setError("Post timed out. Please check your connection and try again.");
      else if (code === "permission-denied") setError("Permission denied. Make sure your email is verified and the Firestore rules are published in Firebase Console.");
      else if (code === "unauthenticated") setError("Your session expired. Please sign out and sign back in.");
      else if (msg) setError(`Error: ${msg}`);
      else setError(t.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-5 pb-28 sm:pb-8 animate-in fade-in duration-200">
      {toast && <SuccessToast message={toast} onDone={() => navigate("/profile")} />}

      <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">{t.postItem}</h1>

      {/* Type selector */}
      <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1 mb-5">
        {(["buy-sell", "lost-found"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTypeChange(tab)}
            className={`flex-1 py-2 min-h-[44px] rounded-lg text-sm font-semibold transition-all ${type === tab ? "bg-white dark:bg-slate-700 shadow text-[#003366] dark:text-slate-100" : "text-gray-500 dark:text-slate-400"}`}
          >
            {tab === "buy-sell" ? t.buySell : t.lostFound}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photos */}
        <div>
          <label className={labelCls}>{t.photos}</label>
          <div className="grid grid-cols-3 gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 hover:border-[#003366] dark:hover:border-blue-500 hover:text-[#003366] dark:hover:text-blue-400 transition-colors"
              >
                <ImagePlus size={22} />
                <span className="text-[10px] mt-1">{t.uploadPhotos}</span>
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1.5">Max 5 MB per photo · Up to 3 photos</p>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
        </div>

        {/* Title */}
        <div>
          <label className={labelCls}>{t.title} *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} />
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>{t.description}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition resize-none"
          />
        </div>

        {/* Category */}
        <div>
          <label className={labelCls}>{t.category}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
            {categories.map((c) => (
              <option key={c} value={c}>{t.categories[c as keyof typeof t.categories]}</option>
            ))}
          </select>
        </div>

        {/* Condition */}
        <div>
          <label className={labelCls}>{t.condition}</label>
          <div className="flex gap-2">
            {(["new", "used"] as Condition[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCondition(c)}
                className={`flex-1 min-h-[44px] py-2 rounded-xl text-sm font-medium border transition-colors ${condition === c ? "bg-[#003366] dark:bg-blue-600 text-white border-[#003366] dark:border-blue-600" : "bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600"}`}
              >
                {c === "new" ? t.conditionNew : t.conditionUsed}
              </button>
            ))}
          </div>
        </div>

        {/* Price */}
        {type === "buy-sell" && (
          <div>
            <label className={labelCls}>{t.price}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 text-sm">RM</span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                step="0.01"
                placeholder="0.00"
                className={`${inputCls} pl-10`}
              />
            </div>
          </div>
        )}

        {/* Contact info */}
        <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">{t.contactInfo}</p>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">{t.whatsapp}</label>
            <input type="text" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+60 12-345 6789" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">{t.wechat}</label>
            <input type="text" value={wechat} onChange={(e) => setWechat(e.target.value)} placeholder="WeChat ID" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">{t.teams}</label>
            <input type="text" value={teams} onChange={(e) => setTeams(e.target.value)} placeholder="student@xmu.edu.my" className={inputCls} />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
            <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !title}
          className="w-full mb-6 bg-[#003366] dark:bg-blue-600 text-white rounded-xl py-3 min-h-[48px] text-sm font-semibold hover:bg-[#002244] dark:hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {t.submitting}
            </span>
          ) : t.submit}
        </button>
      </form>
    </div>
  );
}
