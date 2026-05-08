import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { uploadPhoto, createListing } from "@/lib/listings";
import { checkContent } from "@/lib/contentFilter";
import { auth } from "@/lib/firebase";
import { ListingType, Condition } from "@/lib/types";
import AuthModal from "@/components/AuthModal";
import { ImagePlus, X, AlertCircle, CheckCircle2, Edit2, Wifi, WifiOff } from "lucide-react";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const BUY_SELL_CATEGORIES = [
  "electronics", "books", "clothing", "furniture", "food", "services", "others",
];
const LOST_FOUND_CATEGORIES = ["lostItem", "foundItem"];
const JOBS_CATEGORIES = [
  "tutoring", "freelance_design", "freelance_dev", "language_exchange",
  "photography", "music_lessons", "fitness_coaching", "other_service",
];
const ASSISTANCE_CATEGORIES = [
  "dorm_moving", "grocery_run", "delivery", "cleaning",
  "event_setup", "tech_help", "other_assistance",
];

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

function getCategoriesForType(type: ListingType): string[] {
  if (type === "buy-sell") return BUY_SELL_CATEGORIES;
  if (type === "lost-found") return LOST_FOUND_CATEGORIES;
  if (type === "jobs") return JOBS_CATEGORIES;
  return ASSISTANCE_CATEGORIES;
}

function defaultCategoryForType(type: ListingType): string {
  if (type === "buy-sell") return "electronics";
  if (type === "lost-found") return "lostItem";
  if (type === "jobs") return "tutoring";
  return "dorm_moving";
}

const ALL_TABS: ListingType[] = ["buy-sell", "lost-found", "jobs", "assistance"];

export default function PostPage() {
  const { t } = useLang();
  const { user, userProfile } = useAuth();
  const [, navigate] = useLocation();

  const [type, setType] = useState<ListingType>("buy-sell");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceCents, setPriceCents] = useState(0);
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
  const [showDescEditor, setShowDescEditor] = useState(false);
  const [meetupSpot, setMeetupSpot] = useState("");

  // Jobs-specific
  const [jobSubtype, setJobSubtype] = useState<"offering" | "seeking">("offering");
  const [isRemote, setIsRemote] = useState(false);

  // Assistance-specific
  const [pricingModel, setPricingModel] = useState<"per_hour" | "per_day" | "per_month" | "fixed">("per_hour");
  const [availability, setAvailability] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.whatsapp) setWhatsapp(userProfile.whatsapp);
    if (userProfile.wechat) setWechat(userProfile.wechat);
  }, [userProfile]);

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
        <button onClick={() => window.location.reload()} className="mt-4 text-xs text-[#003366] dark:text-blue-400 underline font-medium">
          I've verified — check again
        </button>
      </div>
    );
  }

  const categories = getCategoriesForType(type);

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
    setCategory(defaultCategoryForType(newType));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const filterResult = checkContent(title, description);
    if (!filterResult.passed) {
      setError(filterResult.reason ?? t.contentNotAllowed);
      setLoading(false);
      return;
    }
    const hasContact = whatsapp.trim() || wechat.trim() || teams.trim();
    if (!hasContact) {
      setError(t.contactRequired);
      setLoading(false);
      return;
    }
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

      const baseData: Record<string, unknown> = {
        type, title, description,
        category, condition, photos: urls,
        userId: user.uid, userEmail: user.email ?? "",
        userName: user.email?.split("@")[0] ?? "",
        whatsapp, wechat, teams,
      };

      if (type === "buy-sell") {
        baseData.price = priceCents / 100;
        baseData.meetupSpot = meetupSpot;
      } else if (type === "lost-found") {
        baseData.meetupSpot = meetupSpot;
      } else if (type === "jobs") {
        baseData.jobSubtype = jobSubtype;
        baseData.isRemote = isRemote;
        if (!isRemote) baseData.meetupSpot = meetupSpot;
        if (priceCents > 0) baseData.price = priceCents / 100;
      } else if (type === "assistance") {
        baseData.price = priceCents / 100;
        baseData.pricingModel = pricingModel;
        baseData.meetupSpot = meetupSpot;
        if (availability.trim()) baseData.availability = availability.trim();
      }

      await withTimeout(createListing(baseData as Parameters<typeof createListing>[0]), 12_000, "create-listing");

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

  const tabLabel = (tab: ListingType) => {
    if (tab === "buy-sell") return t.buySell;
    if (tab === "lost-found") return t.lostFound;
    if (tab === "jobs") return t.jobs;
    return t.assistance;
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-5 pb-28 sm:pb-8 animate-in fade-in duration-200">
      {toast && <SuccessToast message={toast} onDone={() => navigate("/profile")} />}

      <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">{t.postItem}</h1>

      {/* Type selector — 2×2 grid for 4 tabs */}
      <div className="grid grid-cols-2 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 mb-5 gap-1">
        {ALL_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTypeChange(tab)}
            className={`py-2 min-h-[44px] rounded-lg text-sm font-semibold transition-all ${type === tab ? "bg-white dark:bg-slate-700 shadow text-[#003366] dark:text-slate-100" : "text-gray-500 dark:text-slate-400"}`}
          >
            {tabLabel(tab)}
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
                className={`rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 hover:border-[#003366] dark:hover:border-blue-500 hover:text-[#003366] dark:hover:text-blue-400 transition-colors ${photos.length === 0 ? "col-span-3 py-10 gap-2" : "aspect-square"}`}
              >
                <ImagePlus size={photos.length === 0 ? 28 : 22} />
                <span className={photos.length === 0 ? "text-xs mt-1" : "text-[10px] mt-1"}>{t.uploadPhotos}</span>
                {photos.length === 0 && <span className="text-[10px] text-gray-300 dark:text-slate-600">Up to 3 photos · Max 5 MB each</span>}
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1.5">Max 5 MB per photo · Up to 3 photos</p>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
        </div>

        {/* Title */}
        <div>
          <label className={labelCls}>
            {(type === "jobs" || type === "assistance") ? t.serviceTitle : t.title} *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={80}
            placeholder={
              type === "jobs" ? "e.g. Math Tutor Available" :
              type === "assistance" ? "e.g. Help Moving Dorm Room" :
              ""
            }
            className={inputCls}
          />
          <div className={`text-right text-xs mt-1 font-medium ${title.length > 70 ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-slate-500"}`}>
            {title.length} / 80
          </div>
        </div>

        {/* Jobs: subtype selector */}
        {type === "jobs" && (
          <div>
            <label className={labelCls}>{t.jobSubtypeLabel}</label>
            <div className="flex gap-2">
              {(["offering", "seeking"] as const).map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setJobSubtype(sub)}
                  className={`flex-1 min-h-[44px] py-2 rounded-xl text-sm font-medium border transition-colors ${jobSubtype === sub ? "bg-[#003366] dark:bg-blue-600 text-white border-[#003366] dark:border-blue-600" : "bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600"}`}
                >
                  {sub === "offering" ? t.jobSubtypeOffering : t.jobSubtypeSeeking}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
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

        {/* Condition — buy-sell only */}
        {type === "buy-sell" && (
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
        )}

        {/* Price — buy-sell */}
        {type === "buy-sell" && (
          <div>
            <label className={labelCls}>{t.price}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 text-sm font-medium">RM</span>
              <input
                type="text"
                inputMode="numeric"
                value={priceCents === 0 ? "" : (priceCents / 100).toFixed(2)}
                placeholder="0.00"
                onKeyDown={(e) => {
                  if (e.key >= "0" && e.key <= "9") {
                    e.preventDefault();
                    setPriceCents((prev) => { const next = prev * 10 + parseInt(e.key); return next > 9999999 ? prev : next; });
                  } else if (e.key === "Backspace") {
                    e.preventDefault();
                    setPriceCents((prev) => Math.floor(prev / 10));
                  }
                }}
                onFocus={(e) => e.target.select()}
                readOnly={false}
                className={`${inputCls} pl-10 text-right font-mono tracking-wide`}
              />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Type digits to enter price — backspace to correct</p>
          </div>
        )}

        {/* Price — jobs (optional, per hour) */}
        {type === "jobs" && (
          <div>
            <label className={labelCls}>{t.pricePerHour} <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 text-sm font-medium">RM</span>
              <input
                type="text"
                inputMode="numeric"
                value={priceCents === 0 ? "" : (priceCents / 100).toFixed(2)}
                placeholder="0.00"
                onKeyDown={(e) => {
                  if (e.key >= "0" && e.key <= "9") {
                    e.preventDefault();
                    setPriceCents((prev) => { const next = prev * 10 + parseInt(e.key); return next > 9999999 ? prev : next; });
                  } else if (e.key === "Backspace") {
                    e.preventDefault();
                    setPriceCents((prev) => Math.floor(prev / 10));
                  }
                }}
                onFocus={(e) => e.target.select()}
                readOnly={false}
                className={`${inputCls} pl-10 text-right font-mono tracking-wide`}
              />
            </div>
          </div>
        )}

        {/* Jobs: Remote toggle */}
        {type === "jobs" && (
          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              {isRemote ? <Wifi size={16} className="text-sky-500" /> : <WifiOff size={16} className="text-gray-400" />}
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{t.availableRemotely}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsRemote((prev) => !prev)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isRemote ? "bg-sky-500" : "bg-gray-300 dark:bg-slate-600"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isRemote ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        )}

        {/* Assistance: Pricing model */}
        {type === "assistance" && (
          <div>
            <label className={labelCls}>{t.pricingModelLabel}</label>
            <div className="grid grid-cols-2 gap-2">
              {(["per_hour", "per_day", "per_month", "fixed"] as const).map((model) => {
                const label = model === "per_hour" ? t.pricingModelPerHour : model === "per_day" ? t.pricingModelPerDay : model === "per_month" ? t.pricingModelPerMonth : t.pricingModelFixed;
                return (
                  <button
                    key={model}
                    type="button"
                    onClick={() => setPricingModel(model)}
                    className={`min-h-[44px] py-2 rounded-xl text-sm font-medium border transition-colors ${pricingModel === model ? "bg-[#003366] dark:bg-blue-600 text-white border-[#003366] dark:border-blue-600" : "bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Price — assistance (required) */}
        {type === "assistance" && (
          <div>
            <label className={labelCls}>{t.price} *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 text-sm font-medium">RM</span>
              <input
                type="text"
                inputMode="numeric"
                value={priceCents === 0 ? "" : (priceCents / 100).toFixed(2)}
                placeholder="0.00"
                onKeyDown={(e) => {
                  if (e.key >= "0" && e.key <= "9") {
                    e.preventDefault();
                    setPriceCents((prev) => { const next = prev * 10 + parseInt(e.key); return next > 9999999 ? prev : next; });
                  } else if (e.key === "Backspace") {
                    e.preventDefault();
                    setPriceCents((prev) => Math.floor(prev / 10));
                  }
                }}
                onFocus={(e) => e.target.select()}
                readOnly={false}
                className={`${inputCls} pl-10 text-right font-mono tracking-wide`}
              />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Type digits to enter price — backspace to correct</p>
          </div>
        )}

        {/* Assistance: Availability */}
        {type === "assistance" && (
          <div>
            <label className={labelCls}>{t.availability}</label>
            <input
              type="text"
              value={availability}
              onChange={(e) => setAvailability(e.target.value.slice(0, 80))}
              placeholder={t.availabilityPlaceholder}
              maxLength={80}
              className={inputCls}
            />
          </div>
        )}

        {/* Contact info */}
        <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">{t.contactInfo}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{t.contactAtLeastOne}</p>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
              {t.whatsapp}
              <span className="text-amber-500 ml-1 font-medium">{t.whatsappCountryCodeHint}</span>
            </label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.slice(0, 20))}
              placeholder="+60 12-345 6789"
              maxLength={20}
              className={inputCls}
            />
            <p className={`text-right text-[10px] mt-0.5 ${whatsapp.length >= 18 ? "text-amber-500" : "text-gray-400 dark:text-slate-500"}`}>
              {whatsapp.length}/20
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">{t.wechat}</label>
            <input
              type="text"
              value={wechat}
              onChange={(e) => setWechat(e.target.value.slice(0, 30))}
              placeholder="WeChat ID"
              maxLength={30}
              className={inputCls}
            />
            <p className={`text-right text-[10px] mt-0.5 ${wechat.length >= 27 ? "text-amber-500" : "text-gray-400 dark:text-slate-500"}`}>
              {wechat.length}/30
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">{t.teams}</label>
            <input type="text" value={teams} onChange={(e) => setTeams(e.target.value)} placeholder="student@xmu.edu.my" maxLength={60} className={inputCls} />
          </div>
          {/* Meetup spot — hidden for remote jobs */}
          {!(type === "jobs" && isRemote) && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">{t.meetupSpot}</label>
              <input
                type="text"
                value={meetupSpot}
                onChange={(e) => setMeetupSpot(e.target.value.slice(0, 80))}
                placeholder={t.meetupSpotPlaceholder}
                maxLength={80}
                className={inputCls}
              />
              <p className={`text-right text-[10px] mt-0.5 ${meetupSpot.length >= 70 ? "text-amber-500" : "text-gray-400 dark:text-slate-500"}`}>
                {meetupSpot.length}/80
              </p>
            </div>
          )}
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
