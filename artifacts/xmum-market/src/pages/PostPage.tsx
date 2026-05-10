import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { uploadPhoto, createListing, writeRentalTcAuditLog } from "@/lib/listings";
import { checkContent } from "@/lib/contentFilter";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc, increment } from "firebase/firestore";
import { ListingType, Condition } from "@/lib/types";
import { validateWhatsApp, suggestMalaysianFormat } from "@/lib/validation";
import AuthModal from "@/components/AuthModal";
import RentalTcModal from "@/components/RentalTcModal";
import { ImagePlus, X, AlertCircle, CheckCircle2, Edit2, Wifi, WifiOff, ShieldCheck, ShieldOff, Lock } from "lucide-react";

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
const RENTAL_VEHICLE_TYPES = ["car", "bike", "motorcycle", "bicycle", "scooter"] as const;
type VehicleType = typeof RENTAL_VEHICLE_TYPES[number];

const inputCls =
  "w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition min-h-[44px]";

const selectCls =
  "w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition min-h-[44px]";

const labelCls = "block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1";

const FREE_LIMIT = 5;
const VERIFIED_LIMIT = 30;

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
  if (type === "rental") return [...RENTAL_VEHICLE_TYPES];
  return ASSISTANCE_CATEGORIES;
}

function defaultCategoryForType(type: ListingType): string {
  if (type === "buy-sell") return "electronics";
  if (type === "lost-found") return "lostItem";
  if (type === "jobs") return "tutoring";
  if (type === "rental") return "car";
  return "dorm_moving";
}

function CentsInput({
  value,
  onChange,
  placeholder = "0.00",
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 text-sm font-medium">RM</span>
      <input
        type="text"
        inputMode="numeric"
        value={value === 0 ? "" : (value / 100).toFixed(2)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key >= "0" && e.key <= "9") {
            e.preventDefault();
            onChange(Math.min(value * 10 + parseInt(e.key), 9999999));
          } else if (e.key === "Backspace") {
            e.preventDefault();
            onChange(Math.floor(value / 10));
          }
        }}
        onFocus={(e) => e.target.select()}
        readOnly={false}
        className={`${inputCls} pl-10 text-right font-mono tracking-wide`}
      />
    </div>
  );
}

const ALL_TABS: ListingType[] = ["buy-sell", "lost-found", "jobs", "assistance", "rental"];
const VERIFIED_ONLY_TABS: ListingType[] = ["jobs", "assistance", "rental"];

export default function PostPage() {
  const { t } = useLang();
  const { user, userProfile } = useAuth();
  const [, navigate] = useLocation();

  const isVerified = userProfile?.verificationStatus === "approved";
  const activeListingCount = userProfile?.activeListingCount ?? 0;
  const listingLimit = isVerified ? VERIFIED_LIMIT : FREE_LIMIT;

  const [type, setType] = useState<ListingType>("buy-sell");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceCents, setPriceCents] = useState(0);
  const [category, setCategory] = useState("electronics");
  const [condition, setCondition] = useState<Condition>("used");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappError, setWhatsappError] = useState("");
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

  const [jobSubtype, setJobSubtype] = useState<"offering" | "seeking">("offering");
  const [isRemote, setIsRemote] = useState(false);

  const [pricingModel, setPricingModel] = useState<"per_hour" | "per_day" | "per_month" | "fixed">("per_hour");
  const [availability, setAvailability] = useState("");

  const [tcAccepted, setTcAccepted] = useState(false);
  const [showTcModal, setShowTcModal] = useState(false);
  const [prevType, setPrevType] = useState<ListingType>("buy-sell");

  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState(new Date().getFullYear());
  const [plateNumber, setPlateNumber] = useState("");
  const [rentalPricePerDayCents, setRentalPricePerDayCents] = useState(0);
  const [rentalPricePerHourCents, setRentalPricePerHourCents] = useState(0);
  const [depositCents, setDepositCents] = useState(0);
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableTo, setAvailableTo] = useState("");
  const [requiresLicense, setRequiresLicense] = useState(true);
  const [requiresInsuranceProof, setRequiresInsuranceProof] = useState(true);
  const [rentalTerms, setRentalTerms] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  const maxPhotos = type === "rental" ? 5 : 3;

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
    if (photos.length + files.length > maxPhotos) {
      setError(type === "rental" ? "You can upload up to 5 photos for rental listings." : t.uploadLimit);
      return;
    }
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
    // Block verified-only tabs for non-verified users
    if (VERIFIED_ONLY_TABS.includes(newType) && !isVerified) return;

    if (newType === "rental" && !tcAccepted) {
      setPrevType(type);
      setShowTcModal(true);
      return;
    }
    setType(newType);
    setCategory(defaultCategoryForType(newType));
  };

  const handleTcAccepted = () => {
    setTcAccepted(true);
    setShowTcModal(false);
    setType("rental");
    setCategory("car");
  };

  const handleTcCancelled = () => {
    setShowTcModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Check listing limit
    if (activeListingCount >= listingLimit) {
      setError(
        isVerified
          ? `You have reached the maximum of ${VERIFIED_LIMIT} active listings for Verified Sellers.`
          : `Free accounts can have up to ${FREE_LIMIT} active listings. Become a Verified Seller to post more.`
      );
      setLoading(false);
      return;
    }

    if (type === "rental") {
      if (photos.length < 2) {
        setError("Please upload at least 2 photos of the vehicle.");
        setLoading(false);
        return;
      }
      if (!vehicleBrand.trim() || !vehicleModel.trim() || !plateNumber.trim()) {
        setError("Please fill in all required vehicle details (Brand, Model, Plate Number).");
        setLoading(false);
        return;
      }
      if (rentalPricePerDayCents <= 0) {
        setError("Please enter a rental price per day.");
        setLoading(false);
        return;
      }
      if (depositCents <= 0) {
        setError("Please enter a deposit amount.");
        setLoading(false);
        return;
      }
      if (!availableFrom || !availableTo) {
        setError("Please set the availability dates.");
        setLoading(false);
        return;
      }
      if (!whatsapp.trim()) {
        setError("WhatsApp is required for rental listings.");
        setLoading(false);
        return;
      }
    }

    if (whatsapp.trim()) {
      const result = validateWhatsApp(whatsapp);
      if (!result.valid) {
        setError(result.error);
        setLoading(false);
        return;
      }
    }

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

      const now = Date.now();
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
      } else if (type === "rental") {
        baseData.category = vehicleType;
        baseData.vehicleType = vehicleType;
        baseData.vehicleBrand = vehicleBrand.trim();
        baseData.vehicleModel = vehicleModel.trim();
        baseData.vehicleYear = vehicleYear;
        baseData.plateNumber = plateNumber.trim();
        baseData.rentalPricePerDay = rentalPricePerDayCents / 100;
        if (rentalPricePerHourCents > 0) baseData.rentalPricePerHour = rentalPricePerHourCents / 100;
        baseData.depositAmount = depositCents / 100;
        baseData.availableFrom = new Date(availableFrom).getTime();
        baseData.availableTo = new Date(availableTo).getTime();
        baseData.requiresLicense = requiresLicense;
        baseData.requiresInsuranceProof = requiresInsuranceProof;
        if (rentalTerms.trim()) baseData.rentalTerms = rentalTerms.trim();
        baseData.tcAcceptedAt = now;
        baseData.tcAcceptedVersion = "rental-tc-v1";
      }

      const listingId = await withTimeout(createListing(baseData as Parameters<typeof createListing>[0]), 12_000, "create-listing");

      // Increment activeListingCount
      try {
        await updateDoc(doc(db, "users", user.uid), {
          activeListingCount: increment(1),
        });
      } catch (err) {
        console.warn("[PostPage] Failed to increment activeListingCount:", err);
      }

      if (type === "rental") {
        try {
          await writeRentalTcAuditLog(user.uid, user.email ?? "", listingId, title);
        } catch (auditErr) {
          console.warn("[PostPage] Rental audit log write failed (non-fatal):", auditErr);
        }
      }

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
    if (tab === "rental") return t.rental;
    return t.assistance;
  };

  const vehicleTypeLabel = (vt: VehicleType) => {
    if (vt === "car") return `🚗 ${t.rentalCar}`;
    if (vt === "bike") return `🏍️ ${t.rentalBike}`;
    if (vt === "motorcycle") return `🏍️ ${t.rentalMotorcycle}`;
    if (vt === "bicycle") return `🚲 ${t.rentalBicycle}`;
    return `🛵 ${t.rentalScooter}`;
  };

  const currentYear = new Date().getFullYear();

  const isAtLimit = activeListingCount >= listingLimit;

  return (
    <div className="max-w-lg mx-auto px-4 py-5 pb-28 sm:pb-8 animate-in fade-in duration-200">
      {toast && <SuccessToast message={toast} onDone={() => navigate("/profile")} />}

      {showTcModal && (
        <RentalTcModal onAccept={handleTcAccepted} onCancel={handleTcCancelled} />
      )}

      <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">{t.postItem}</h1>

      {/* Listing limit notice */}
      {isAtLimit && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {isVerified
              ? `You've reached the ${VERIFIED_LIMIT}-listing limit for Verified Sellers.`
              : `Free accounts are limited to ${FREE_LIMIT} active listings. `}
            {!isVerified && (
              <a href="/settings#shop-verification" className="underline font-semibold">Become a Verified Seller</a>
            )}
            {!isVerified && " for up to 30."}
          </p>
        </div>
      )}

      {/* Tier notice for non-verified */}
      {!isVerified && !isAtLimit && (
        <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
          Free account: <strong>{activeListingCount} / {FREE_LIMIT}</strong> listings used.{" "}
          <a href="/settings#shop-verification" className="underline font-semibold">Upgrade to Verified</a> for 30 listings + all post types.
        </div>
      )}

      {/* Type selector */}
      <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1 mb-5 gap-1 overflow-x-auto scrollbar-hide">
        {ALL_TABS.map((tab) => {
          const locked = VERIFIED_ONLY_TABS.includes(tab) && !isVerified;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => handleTypeChange(tab)}
              disabled={locked}
              title={locked ? "Verified Sellers only — upgrade in Settings" : undefined}
              className={`flex-1 min-w-[72px] py-2 min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap relative ${
                type === tab
                  ? "bg-white dark:bg-slate-700 shadow text-[#003366] dark:text-slate-100"
                  : locked
                  ? "text-gray-300 dark:text-slate-600 cursor-not-allowed"
                  : "text-gray-500 dark:text-slate-400"
              }`}
            >
              {locked && <Lock size={9} className="inline mb-0.5 mr-0.5 text-gray-400" />}
              {tabLabel(tab)}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photos */}
        <div>
          <label className={labelCls}>
            {type === "rental"
              ? `Photos (min 2, max 5) *`
              : t.photos}
          </label>
          {type === "rental" && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">{t.rentalPhotosNote}</p>
          )}
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
            {photos.length < maxPhotos && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 hover:border-[#003366] dark:hover:border-blue-500 hover:text-[#003366] dark:hover:text-blue-400 transition-colors ${photos.length === 0 ? "col-span-3 py-10 gap-2" : "aspect-square"}`}
              >
                <ImagePlus size={photos.length === 0 ? 28 : 22} />
                <span className={photos.length === 0 ? "text-xs mt-1" : "text-[10px] mt-1"}>{t.uploadPhotos}</span>
                {photos.length === 0 && (
                  <span className="text-[10px] text-gray-300 dark:text-slate-600">
                    {type === "rental" ? "Min 2 · Max 5 photos · Max 5 MB each" : "Up to 3 photos · Max 5 MB each"}
                  </span>
                )}
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1.5">
            Max 5 MB per photo · {type === "rental" ? `Min 2, up to ${maxPhotos} photos` : `Up to ${maxPhotos} photos`}
          </p>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
        </div>

        {/* Title */}
        <div>
          <label className={labelCls}>
            {(type === "jobs" || type === "assistance") ? t.serviceTitle : type === "rental" ? "Listing Title *" : t.title} *
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
              type === "rental" ? "e.g. 2020 Honda City Available for Rent" :
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
                  className={`flex-1 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    jobSubtype === sub
                      ? "bg-[#003366] dark:bg-blue-600 text-white border-[#003366] dark:border-blue-600"
                      : "bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-[#003366] dark:hover:border-blue-500"
                  }`}
                >
                  {sub === "offering" ? `▶ ${t.offeringLabel}` : `◀ ${t.seekingLabel}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Remote toggle for jobs */}
        {type === "jobs" && (
          <div className="flex items-center justify-between bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 min-h-[56px]">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">{t.remoteToggle}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{t.remoteToggleDesc}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsRemote(!isRemote)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isRemote ? "bg-[#003366] dark:bg-blue-600" : "bg-gray-200 dark:bg-slate-500"}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isRemote ? "left-6" : "left-1"}`} />
            </button>
          </div>
        )}

        {/* Description */}
        <div>
          <label className={labelCls}>
            {(type === "jobs" || type === "assistance") ? t.serviceDesc : t.descriptionLabel} *
          </label>
          <button
            type="button"
            onClick={() => setShowDescEditor(true)}
            className={`w-full text-left border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm min-h-[80px] bg-white dark:bg-slate-700 ${
              description ? "text-gray-900 dark:text-slate-100" : "text-gray-400 dark:text-slate-500"
            }`}
          >
            {description ? (
              <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-3 leading-relaxed whitespace-pre-wrap">{description}</span>
                <Edit2 size={14} className="text-gray-400 dark:text-slate-500 shrink-0 mt-0.5" />
              </div>
            ) : (
              <span>{t.descriptionPlaceholder}</span>
            )}
          </button>
          {description && (
            <div className={`text-right text-xs mt-1 font-medium ${description.length > 900 ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-slate-500"}`}>
              {description.length} / 1000
            </div>
          )}
        </div>
        {showDescEditor && (
          <DescriptionEditorModal
            value={description}
            onChange={setDescription}
            onClose={() => setShowDescEditor(false)}
          />
        )}

        {/* Category */}
        <div>
          <label className={labelCls}>{t.category}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {(t.categories as any)[cat] ?? cat}
              </option>
            ))}
          </select>
        </div>

        {/* Rental: Vehicle details */}
        {type === "rental" && (
          <>
            <div>
              <label className={labelCls}>Vehicle Type *</label>
              <div className="grid grid-cols-5 gap-1.5">
                {RENTAL_VEHICLE_TYPES.map((vt) => (
                  <button
                    key={vt}
                    type="button"
                    onClick={() => setVehicleType(vt)}
                    className={`py-2 rounded-xl text-xs font-semibold border min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                      vehicleType === vt
                        ? "bg-[#003366] dark:bg-blue-600 text-white border-transparent"
                        : "bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600"
                    }`}
                  >
                    <span className="text-lg">{vt === "car" ? "🚗" : vt === "bicycle" ? "🚲" : vt === "scooter" ? "🛵" : "🏍️"}</span>
                    <span className="text-[9px] capitalize">{vt}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t.rentalBrandLabel} *</label>
                <input type="text" value={vehicleBrand} onChange={(e) => setVehicleBrand(e.target.value)} placeholder="e.g. Honda" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t.rentalModelLabel} *</label>
                <input type="text" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="e.g. City" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t.rentalYearLabel}</label>
                <input type="number" value={vehicleYear} onChange={(e) => setVehicleYear(Number(e.target.value))} min={1990} max={currentYear + 1} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t.rentalPlateNumber} *</label>
                <input type="text" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value.toUpperCase())} placeholder="e.g. PBJ 1234" className={`${inputCls} uppercase font-mono tracking-widest`} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Per Day (RM) *</label>
                <CentsInput value={rentalPricePerDayCents} onChange={setRentalPricePerDayCents} />
              </div>
              <div>
                <label className={labelCls}>Per Hour (RM) <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                <CentsInput value={rentalPricePerHourCents} onChange={setRentalPricePerHourCents} />
              </div>
              <div>
                <label className={labelCls}>{t.rentalDeposit} (RM) *</label>
                <CentsInput value={depositCents} onChange={setDepositCents} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t.rentalAvailFrom}</label>
                <input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} className={inputCls} min={new Date().toISOString().split("T")[0]} />
              </div>
              <div>
                <label className={labelCls}>{t.rentalAvailTo}</label>
                <input type="date" value={availableTo} onChange={(e) => setAvailableTo(e.target.value)} className={inputCls} min={availableFrom || new Date().toISOString().split("T")[0]} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 min-h-[52px]">
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">{t.rentalLicenceRequired}</p>
                </div>
                <button type="button" onClick={() => setRequiresLicense(!requiresLicense)} className={`relative w-11 h-6 rounded-full transition-colors ${requiresLicense ? "bg-[#003366] dark:bg-blue-600" : "bg-gray-200 dark:bg-slate-500"}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${requiresLicense ? "left-6" : "left-1"}`} />
                </button>
              </div>
              <div className="flex items-center justify-between bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 min-h-[52px]">
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">{t.rentalInsuranceRequired}</p>
                </div>
                <button type="button" onClick={() => setRequiresInsuranceProof(!requiresInsuranceProof)} className={`relative w-11 h-6 rounded-full transition-colors ${requiresInsuranceProof ? "bg-[#003366] dark:bg-blue-600" : "bg-gray-200 dark:bg-slate-500"}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${requiresInsuranceProof ? "left-6" : "left-1"}`} />
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>{t.rentalSellerTerms} <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <textarea value={rentalTerms} onChange={(e) => setRentalTerms(e.target.value.slice(0, 500))} rows={3} className={`${inputCls} resize-none`} placeholder={t.rentalTermsPlaceholder} />
            </div>
          </>
        )}

        {/* Condition — Buy & Sell only */}
        {type === "buy-sell" && (
          <div>
            <label className={labelCls}>{t.condition}</label>
            <div className="flex gap-2">
              {(["used", "new"] as Condition[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={`flex-1 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    condition === c
                      ? "bg-[#003366] dark:bg-blue-600 text-white border-[#003366] dark:border-blue-600"
                      : "bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-[#003366] dark:hover:border-blue-500"
                  }`}
                >
                  {c === "new" ? t.conditionNew : t.conditionUsed}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Price */}
        {(type === "buy-sell" || type === "assistance") && (
          <div>
            <label className={labelCls}>
              {type === "buy-sell" ? t.price : t.serviceRate}
              {type === "buy-sell" && <span className="ml-1 text-xs text-gray-400 font-normal">(enter 0 for free)</span>}
            </label>
            {type === "assistance" && (
              <div className="flex gap-2 mb-2">
                {(["per_hour", "per_day", "per_month", "fixed"] as const).map((model) => (
                  <button
                    key={model}
                    type="button"
                    onClick={() => setPricingModel(model)}
                    className={`flex-1 min-h-[40px] py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      pricingModel === model
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600"
                    }`}
                  >
                    {(t as any)[`${model}Label`] ?? model}
                  </button>
                ))}
              </div>
            )}
            <CentsInput value={priceCents} onChange={setPriceCents} />
          </div>
        )}

        {/* Jobs: rate (optional) */}
        {type === "jobs" && (
          <div>
            <label className={labelCls}>{t.hourlyRate} <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <CentsInput value={priceCents} onChange={setPriceCents} />
          </div>
        )}

        {/* Availability (Assistance) */}
        {type === "assistance" && (
          <div>
            <label className={labelCls}>{t.availability} <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <input type="text" value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder={t.availabilityPlaceholder} className={inputCls} />
          </div>
        )}

        {/* Meetup spot */}
        {(type !== "rental" && !(type === "jobs" && isRemote)) && (
          <div>
            <label className={labelCls}>
              {t.meetupSpot} <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={meetupSpot}
              onChange={(e) => setMeetupSpot(e.target.value)}
              placeholder={type === "jobs" || type === "assistance" ? "e.g. Library, Block A, etc." : t.meetupSpotPlaceholder}
              className={inputCls}
            />
          </div>
        )}

        {/* Contact info */}
        <div className="bg-white dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{t.contactInfo}</p>
          <div>
            <label className={labelCls}>
              WhatsApp {type === "rental" ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(optional)</span>}
            </label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => { setWhatsapp(e.target.value); setWhatsappError(""); }}
              onBlur={() => {
                if (!whatsapp.trim()) return;
                const result = validateWhatsApp(whatsapp);
                if (!result.valid) {
                  const suggested = suggestMalaysianFormat(whatsapp);
                  setWhatsappError(suggested !== whatsapp ? result.error + ` Did you mean ${suggested}?` : result.error);
                }
              }}
              placeholder="+60123456789"
              className={inputCls}
            />
            {whatsappError ? (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {whatsappError}</p>
            ) : (
              <p className="text-xs text-slate-400 mt-1">Include country code, e.g. +60 for Malaysia</p>
            )}
          </div>
          {type !== "rental" && (
            <div>
              <label className={labelCls}>WeChat ID <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="text" value={wechat} onChange={(e) => setWechat(e.target.value)} placeholder="WeChat ID" className={inputCls} />
            </div>
          )}
          {type !== "rental" && (
            <div>
              <label className={labelCls}>Microsoft Teams <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="text" value={teams} onChange={(e) => setTeams(e.target.value)} placeholder="your@xmu.edu.my" className={inputCls} />
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || isAtLimit}
          className="w-full min-h-[52px] bg-[#003366] dark:bg-blue-600 text-white rounded-xl text-sm font-bold py-3 hover:bg-[#002244] dark:hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t.posting}
            </>
          ) : (
            t.postItem
          )}
        </button>
      </form>
    </div>
  );
}
