import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { uploadPhoto, updateListing, getListing } from "@/lib/listings";
import { auth } from "@/lib/firebase";
import { ListingType, Condition } from "@/lib/types";
import { ImagePlus, X, AlertCircle, CheckCircle2, Lock, Edit2, Loader2 } from "lucide-react";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

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

interface DescriptionEditorModalProps {
  value: string;
  onChange: (val: string) => void;
  onClose: () => void;
}

function DescriptionEditorModal({ value, onChange, onClose }: DescriptionEditorModalProps) {
  const [draft, setDraft] = useState(value);
  const { t } = useLang();

  const handleSave = () => {
    onChange(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
        >
          {t.cancel}
        </button>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
          {t.descriptionLabel}
        </h2>
        <button
          type="button"
          onClick={handleSave}
          className="text-sm font-semibold text-[#003366] dark:text-blue-400 hover:opacity-75 transition-opacity"
        >
          {t.done}
        </button>
      </div>
      <div className="flex flex-col flex-1 px-4 py-3 overflow-hidden">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
          maxLength={1000}
          placeholder={t.descriptionPlaceholder}
          className="flex-1 w-full resize-none bg-transparent text-gray-900 dark:text-slate-100 text-sm leading-relaxed placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none"
        />
        <div className={`text-right text-xs mt-2 font-medium ${draft.length > 900 ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-slate-500"}`}>
          {draft.length} / 1000
        </div>
      </div>
    </div>
  );
}

export default function EditListingPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();

  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [type, setType] = useState<ListingType>("buy-sell");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("electronics");
  const [condition, setCondition] = useState<Condition>("used");
  const [whatsapp, setWhatsapp] = useState("");
  const [wechat, setWechat] = useState("");
  const [teams, setTeams] = useState("");
  const [meetupSpot, setMeetupSpot] = useState("");
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showDescEditor, setShowDescEditor] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) { setFetchError("Invalid listing ID."); setFetchLoading(false); return; }
    getListing(id)
      .then((listing) => {
        if (!listing) { setFetchError("Listing not found."); return; }
        if (listing.userId !== user?.uid) {
          setFetchError("You don't have permission to edit this listing.");
          return;
        }
        setType(listing.type);
        setTitle(listing.title);
        setDescription(listing.description);
        setPrice(listing.price?.toString() ?? "");
        setCategory(listing.category);
        setCondition(listing.condition);
        setWhatsapp(listing.whatsapp ?? "");
        setWechat(listing.wechat ?? "");
        setTeams(listing.teams ?? "");
        setMeetupSpot(listing.meetupSpot ?? "");
        setExistingPhotos(listing.photos);
      })
      .catch(() => setFetchError("Failed to load listing. Please try again."))
      .finally(() => setFetchLoading(false));
  }, [id, user?.uid]);

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-[#003366] dark:text-blue-400" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-3">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-gray-600 dark:text-slate-300">{fetchError}</p>
        <button onClick={() => navigate("/profile")} className="text-sm text-[#003366] dark:text-blue-400 underline">
          Back to Profile
        </button>
      </div>
    );
  }

  const totalPhotos = existingPhotos.length + photos.length;
  const categories = type === "buy-sell" ? BUY_SELL_CATEGORIES : LOST_FOUND_CATEGORIES;

  function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout:${label}`)), ms)),
    ]);
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (totalPhotos + files.length > 3) { setError(t.uploadLimit); return; }
    const oversized = files.find((f) => f.size > MAX_FILE_BYTES);
    if (oversized) { setError(t.imageTooLarge); return; }
    setError("");
    setPhotos([...photos, ...files]);
    setPreviews([...previews, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removeExistingPhoto = (i: number) => {
    setExistingPhotos(existingPhotos.filter((_, idx) => idx !== i));
  };

  const removeNewPhoto = (i: number) => {
    setPhotos(photos.filter((_, idx) => idx !== i));
    setPreviews(previews.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await withTimeout(auth.currentUser?.getIdToken(true) ?? Promise.resolve(""), 10_000, "token-refresh");

      const newUrls: string[] = [];
      for (const f of photos) {
        try {
          const url = await withTimeout(uploadPhoto(f, user!.uid), 30_000, "photo-upload");
          newUrls.push(url);
        } catch (photoErr: any) {
          console.warn("[EditListingPage] Photo skipped:", photoErr?.message);
        }
      }

      const baseData: Record<string, unknown> = {
        title, description,
        category, condition,
        photos: [...existingPhotos, ...newUrls],
        whatsapp, wechat, teams, meetupSpot,
      };
      if (type === "buy-sell") {
        baseData.price = parseFloat(price) || 0;
      }

      await withTimeout(updateListing(id, baseData as Parameters<typeof updateListing>[1]), 12_000, "update-listing");
      setToast("Listing updated successfully!");
    } catch (err: any) {
      const code: string = err?.code ?? "";
      const msg: string = err?.message ?? "";
      if (msg.startsWith("timeout:token-refresh")) setError("Session refresh timed out. Please sign out and sign back in.");
      else if (msg.startsWith("timeout:photo-upload")) setError("A photo upload timed out. Try a smaller image or check your connection.");
      else if (msg.startsWith("timeout:update-listing")) setError("Update timed out. Please check your connection and try again.");
      else if (code === "permission-denied") setError("Permission denied. Make sure your email is verified.");
      else if (code === "unauthenticated") setError("Your session expired. Please sign out and sign back in.");
      else if (msg) setError(`Error: ${msg}`);
      else setError(t.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-5 pb-28 sm:pb-8 animate-in fade-in duration-200">
      {toast && <SuccessToast message={toast} onDone={() => navigate(`/listing/${id}`)} />}

      <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">{t.editListingTitle}</h1>

      {/* Type selector — disabled/read-only after posting */}
      <div className="mb-5">
        <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1 pointer-events-none opacity-60">
          {(["buy-sell", "lost-found"] as const).map((tab) => (
            <div
              key={tab}
              className={`flex-1 py-2 min-h-[44px] rounded-lg text-sm font-semibold text-center flex items-center justify-center transition-all ${type === tab ? "bg-white dark:bg-slate-700 shadow text-[#003366] dark:text-slate-100" : "text-gray-500 dark:text-slate-400"}`}
            >
              {tab === "buy-sell" ? t.buySell : t.lostFound}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
          <Lock size={10} />
          {t.typeLockedNote}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photos — existing + new */}
        <div>
          <label className={labelCls}>{t.photos}</label>
          <div className="grid grid-cols-3 gap-2">
            {existingPhotos.map((src, i) => (
              <div key={`existing-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeExistingPhoto(i)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {previews.map((src, i) => (
              <div key={`new-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-blue-200 dark:border-blue-600">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeNewPhoto(i)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {totalPhotos < 3 && (
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
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={80}
            className={inputCls}
          />
          <div className={`text-right text-xs mt-1 font-medium ${title.length > 70 ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-slate-500"}`}>
            {title.length} / 80
          </div>
        </div>

        {/* Description — tappable preview */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
            {t.descriptionLabel}
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <button
            type="button"
            onClick={() => setShowDescEditor(true)}
            className="w-full min-h-[80px] text-left bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition flex items-start justify-between gap-2"
          >
            <span className={description ? "text-gray-900 dark:text-slate-100 line-clamp-3 flex-1" : "text-gray-400 dark:text-slate-500 flex-1"}>
              {description || t.descriptionPlaceholder}
            </span>
            <Edit2 size={15} className="text-gray-400 dark:text-slate-500 mt-0.5 shrink-0" />
          </button>
          {description && (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 text-right">
              {description.length} / 1000
            </p>
          )}
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

        {/* Price (buy-sell only) */}
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
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">{t.meetupSpot}</label>
            <input type="text" value={meetupSpot} onChange={(e) => setMeetupSpot(e.target.value)} placeholder={t.meetupSpotPlaceholder} className={inputCls} />
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
          ) : t.save}
        </button>
      </form>

      {showDescEditor && (
        <DescriptionEditorModal
          value={description}
          onChange={(val) => setDescription(val)}
          onClose={() => setShowDescEditor(false)}
        />
      )}
    </div>
  );
}
