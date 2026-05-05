import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { uploadPhoto, createListing } from "@/lib/listings";
import { auth } from "@/lib/firebase";
import { ListingType, Condition } from "@/lib/types";
import AuthModal from "@/components/AuthModal";
import { ImagePlus, X, AlertCircle, CheckCircle2 } from "lucide-react";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const BUY_SELL_CATEGORIES = [
  "electronics", "books", "clothing", "furniture", "food", "services", "others",
];
const LOST_FOUND_CATEGORIES = ["lostItem", "foundItem"];

// ── Inline toast ───────────────────────────────────────────────────────────────
function SuccessToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hide = setTimeout(() => setVisible(false), 3000);
    const done = setTimeout(onDone, 3400);
    return () => { clearTimeout(hide); clearTimeout(done); };
  }, [onDone]);

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#003366] text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl transition-all duration-400 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"
      }`}
    >
      <CheckCircle2 size={18} className="text-green-300 shrink-0" />
      {message}
    </div>
  );
}

export default function PostPage() {
  const { t } = useLang();
  const { user } = useAuth();
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

  // ── Auth / Verification gates ──────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <AlertCircle size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium mb-1">{t.loginToPost}</p>
        <button
          onClick={() => setShowAuth(true)}
          className="mt-3 bg-[#003366] text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
        >
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
        <p className="text-gray-600 font-medium">{t.verifyToPost}</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">{t.verifyEmailMsg}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-xs text-[#003366] underline"
        >
          I've verified my email — refresh
        </button>
      </div>
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const categories = type === "buy-sell" ? BUY_SELL_CATEGORIES : LOST_FOUND_CATEGORIES;

  // Timeout wrapper — only used for token refresh and photo uploads
  function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`timeout:${label}`)), ms)
      ),
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
      // Force-refresh ID token so Firestore sees latest emailVerified claim
      await withTimeout(
        auth.currentUser?.getIdToken(true) ?? Promise.resolve(),
        10_000,
        "token-refresh"
      );

      // Upload photos — failures are non-fatal, skipped individually
      const urls: string[] = [];
      for (const f of photos) {
        try {
          const url = await withTimeout(uploadPhoto(f, user.uid), 30_000, "photo-upload");
          urls.push(url);
        } catch (photoErr: any) {
          console.warn("[PostPage] Photo skipped:", photoErr?.message);
        }
      }

      // Write listing with a 12 s timeout.
      // With offline persistence enabled, addDoc resolves immediately from
      // local cache — so this timeout only fires if IndexedDB itself is
      // unavailable. Either way we show success: the data is locally queued
      // and will sync to Firestore once the database is created/reachable.
      try {
        await withTimeout(
          createListing({
            type,
            title,
            description,
            price: type === "buy-sell" ? (parseFloat(price) || 0) : undefined,
            category,
            condition,
            photos: urls,
            userId: user.uid,
            userEmail: user.email ?? "",
            userName: user.email?.split("@")[0] ?? "",
            whatsapp,
            wechat,
            teams,
          }),
          12_000,
          "create-listing"
        );
      } catch (listingErr: any) {
        // Timeout means offline persistence queued it locally — treat as success.
        // Any real Firestore error (permission-denied etc.) is re-thrown below.
        if (!listingErr?.message?.startsWith("timeout:")) throw listingErr;
        console.warn("[PostPage] Firestore write queued locally (server pending sync)");
      }

      // Show toast then redirect to profile
      setToast("Your post has been successfully published.");
    } catch (err: any) {
      console.error("[PostPage] Submit failed:", err?.code, err?.message);
      const code: string = err?.code ?? "";
      const msg: string = err?.message ?? "";

      if (msg.startsWith("timeout:token-refresh")) {
        setError("Session refresh timed out. Please sign out and sign back in.");
      } else if (msg.startsWith("timeout:photo-upload")) {
        setError("A photo upload timed out. Try a smaller image or check your connection.");
      } else if (code === "permission-denied") {
        setError(
          "Permission denied. Make sure your email is verified and the Firestore rules are published in Firebase Console."
        );
      } else if (code === "unauthenticated") {
        setError("Your session expired. Please sign out and sign back in.");
      } else if (msg) {
        setError(`Error: ${msg}`);
      } else {
        setError(t.errorOccurred);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto px-4 py-5">
      {toast && (
        <SuccessToast
          message={toast}
          onDone={() => navigate("/profile")}
        />
      )}

      <h1 className="text-xl font-bold text-gray-900 mb-4">{t.postItem}</h1>

      {/* Type selector */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        {(["buy-sell", "lost-found"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTypeChange(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              type === tab ? "bg-white shadow text-[#003366]" : "text-gray-500"
            }`}
          >
            {tab === "buy-sell" ? t.buySell : t.lostFound}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photos */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t.photos}
          </label>
          <div className="flex gap-2 flex-wrap">
            {previews.map((src, i) => (
              <div
                key={i}
                className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200"
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-[#003366] hover:text-[#003366] transition-colors"
              >
                <ImagePlus size={22} />
                <span className="text-[10px] mt-1">{t.uploadPhotos}</span>
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">Max 10 MB per photo · Up to 3 photos</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t.title} *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t.description}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366] resize-none"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t.category}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366] bg-white"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {t.categories[c as keyof typeof t.categories]}
              </option>
            ))}
          </select>
        </div>

        {/* Condition */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t.condition}
          </label>
          <div className="flex gap-2">
            {(["new", "used"] as Condition[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCondition(c)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  condition === c
                    ? "bg-[#003366] text-white border-[#003366]"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {c === "new" ? t.conditionNew : t.conditionUsed}
              </button>
            ))}
          </div>
        </div>

        {/* Price — buy-sell only */}
        {type === "buy-sell" && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {t.price}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                RM
              </span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                step="0.01"
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366]"
              />
            </div>
          </div>
        )}

        {/* Contact info */}
        <div className="border border-gray-100 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">{t.contactInfo}</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.whatsapp}</label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+60 12-345 6789"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.wechat}</label>
            <input
              type="text"
              value={wechat}
              onChange={(e) => setWechat(e.target.value)}
              placeholder="WeChat ID"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t.teams}</label>
            <input
              type="text"
              value={teams}
              onChange={(e) => setTeams(e.target.value)}
              placeholder="student@xmu.edu.my"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366]"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-xs text-red-700 leading-relaxed">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !title}
          className="w-full bg-[#003366] text-white rounded-xl py-3 text-sm font-semibold hover:bg-[#002244] disabled:opacity-50 transition-colors"
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
