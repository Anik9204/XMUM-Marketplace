import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { uploadPhoto, createListing, writeRentalTcAuditLog } from "@/lib/listings";
import { checkContent } from "@/lib/contentFilter";
import { moderateContent } from "@/lib/aiModerate";
import { writeAiFlag } from "@/lib/aiFlag";
import { auth, db, storage } from "@/lib/firebase";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { doc, updateDoc, increment, getCountFromServer, collection, query, where } from "firebase/firestore";
import { ListingType, Condition, Listing } from "@/lib/types";
import { validateWhatsApp, suggestMalaysianFormat } from "@/lib/validation";
import AuthModal from "@/components/AuthModal";
import RentalTcModal from "@/components/RentalTcModal";
import ListingCard from "@/components/ListingCard";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  ImagePlus, X, AlertCircle, CheckCircle2, Edit2, Wifi, WifiOff,
  Eye, EyeOff, Loader2,
} from "lucide-react";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const DRAFT_KEY = "xmum_post_draft_v2";

const BUY_SELL_CATEGORIES = [
  "electronics", "books", "clothing", "furniture", "food", "services", "car", "motorcycle", "others",
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
const RENTAL_VEHICLE_TYPES = ["car", "motorcycle", "bicycle", "electric-bike"] as const;
type VehicleType = typeof RENTAL_VEHICLE_TYPES[number];

const inputCls =
  "w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#003366]/30 dark:focus:ring-blue-400/30 focus:border-[#003366] dark:focus:border-blue-400 transition min-h-[44px] shadow-sm";

const selectCls =
  "w-full bg-white text-gray-900 border border-gray-200 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-[#003366]/30 dark:focus:ring-blue-400/30 focus:border-[#003366] dark:focus:border-blue-400 transition min-h-[44px] shadow-sm";

const labelCls = "block text-sm font-display font-semibold text-gray-700 dark:text-slate-300 mb-1";

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (hours < 1) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

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
          onChange={(e) => setDraft(e.target.value.slice(0, 3000))}
          maxLength={3000}
          placeholder={t.descriptionPlaceholder}
          className="flex-1 w-full resize-none bg-transparent text-gray-900 dark:text-slate-100 text-sm leading-relaxed placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none"
        />
        <div className={`text-right text-xs mt-2 font-medium ${draft.length > 2700 ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-slate-500"}`}>
          {draft.length} / 3000
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

function formatCents(cents: number): string {
  const ringgit = Math.floor(cents / 100);
  const sen = cents % 100;
  return ringgit.toLocaleString("en-MY") + "." + sen.toString().padStart(2, "0");
}

function CentsInput({
  value,
  onChange,
  placeholder: _placeholder = "0.00",
  className,
  onBlur,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
  onBlur?: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      onChange(Math.floor(value / 10));
    } else if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      const digit = parseInt(e.key, 10);
      const newCents = value * 10 + digit;
      if (newCents <= 100_000_000) {
        onChange(newCents);
      }
    } else {
      e.preventDefault();
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <span className="text-gray-500 dark:text-slate-400 text-sm font-semibold shrink-0">RM</span>
      <input
        type="text"
        inputMode="numeric"
        value={formatCents(value)}
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        className={`${inputCls} text-right font-mono tracking-wide`}
      />
    </div>
  );
}

const ALL_TABS: ListingType[] = ["buy-sell", "lost-found", "jobs", "assistance", "rental"];

function getLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || fullName.trim();
}

export default function PostPage() {
  const { t } = useLang();
  const { user, userProfile } = useAuth();
  const [, navigate] = useLocation();

  const activeListingCount = userProfile?.activeListingCount ?? 0;
  const [realActiveCount, setRealActiveCount] = useState<number | null>(null);

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

  // FIX 3: Unsaved changes
  const [isDirty, setIsDirty] = useState(false);

  // FIX 2: Live preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewListing, setPreviewListing] = useState<Listing>({
    id: "preview", type: "buy-sell", title: "", description: "", category: "electronics",
    condition: "used", photos: [], userId: "", userEmail: "", userName: "You",
    createdAt: Date.now(), isArchived: false, status: "active",
  });
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [aiChecking, setAiChecking] = useState(false);

  // FIX 4: Content filter UX
  const [fieldError, setFieldError] = useState<"content" | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // FIX 5: Draft
  const [draftBanner, setDraftBanner] = useState<{ savedAt: number; draft: any } | null>(null);

  // FIX 1: Drag-and-drop
  const [dragOverZone, setDragOverZone] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const dragIndexRef = useRef<number>(-1);
  const fileRef = useRef<HTMLInputElement>(null);

  const maxPhotos = type === "rental" ? 5 : 3;

  // Fetch the real active listing count from Firestore to avoid stale counter drift
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    async function fetchRealCount() {
      try {
        const q = query(
          collection(db, "listings"),
          where("userId", "==", user!.uid),
          where("isArchived", "==", false),
          where("status", "==", "active")
        );
        const snap = await getCountFromServer(q);
        if (!cancelled) setRealActiveCount(snap.data().count);
      } catch {
        if (!cancelled) setRealActiveCount(userProfile?.activeListingCount ?? 0);
      }
    }
    fetchRealCount();
    return () => { cancelled = true; };
  }, [user?.uid]);

  // FIX 3: beforeunload
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useUnsavedChangesGuard(isDirty);

  // FIX 2: Preview debounce
  useEffect(() => {
    clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => {
      setPreviewListing({
        id: "preview",
        type,
        title: title || "Your listing title",
        description,
        price: priceCents / 100,
        category,
        condition,
        photos: previews.length > 0 ? [previews[0]] : [],
        userId: "",
        userEmail: "",
        userName: "You",
        createdAt: Date.now(),
        isArchived: false,
        status: "active",
      });
    }, 500);
    return () => clearTimeout(previewDebounceRef.current);
  }, [title, priceCents, previews, category, type, condition, description]);

  // Pre-select listing type from URL ?type= param on mount (overrides draft)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlType = params.get("type") as ListingType | null;
    const validTypes: ListingType[] = ["buy-sell", "lost-found", "jobs", "assistance", "rental"];
    if (urlType && validTypes.includes(urlType)) {
      if (urlType === "rental" && !tcAccepted) {
        setShowTcModal(true);
      } else {
        setType(urlType);
        setCategory(defaultCategoryForType(urlType));
      }
    }
  }, []);

  // FIX 5: Draft restore on mount
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        const ageMs = Date.now() - (draft.savedAt ?? 0);
        if (ageMs < 7 * 24 * 60 * 60 * 1000) {
          setDraftBanner({ savedAt: draft.savedAt, draft });
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, []);

  // FIX 5: Auto-save interval
  useEffect(() => {
    const id = setInterval(saveDraft, 30_000);
    return () => clearInterval(id);
  }, [type, title, description, priceCents, category, condition, whatsapp, wechat, meetupSpot]);

  // Prefill contact info from profile
  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.whatsapp) setWhatsapp(userProfile.whatsapp);
    if (userProfile.wechat) setWechat(userProfile.wechat);
  }, [userProfile]);

  useEffect(() => {
    if (user?.email) setTeams(user.email);
  }, [user, type]);

  // Auto-dismiss photo error
  useEffect(() => {
    if (!photoError) return;
    const id = setTimeout(() => setPhotoError(""), 4000);
    return () => clearTimeout(id);
  }, [photoError]);

  function saveDraft() {
    const draft = {
      type, title, description, price: priceCents, category,
      condition, whatsapp, wechat, meetupSpot,
      savedAt: Date.now(),
    };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {
      console.warn("[PostPage] Draft save failed — localStorage may be full.");
    }
  }

  function restoreDraft() {
    if (!draftBanner) return;
    const d = draftBanner.draft;
    if (d.type) setType(d.type);
    if (d.title) setTitle(String(d.title).slice(0, 100));
    if (d.description) setDescription(String(d.description).slice(0, 3000));
    if (d.price != null) setPriceCents(Number(d.price));
    if (d.category) setCategory(d.category);
    if (d.condition) setCondition(d.condition);
    if (d.whatsapp) setWhatsapp(d.whatsapp);
    if (d.wechat) setWechat(d.wechat);
    if (d.meetupSpot) setMeetupSpot(String(d.meetupSpot).slice(0, 200));
    setDraftBanner(null);
  }

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

  // FIX 1: Add files from input or drop
  function addFiles(files: File[]) {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (photos.length + imageFiles.length > maxPhotos) {
      setPhotoError(type === "rental" ? "You can upload up to 5 photos for rental listings." : t.uploadLimit);
      return;
    }
    const oversized = imageFiles.find((f) => f.size > MAX_FILE_BYTES);
    if (oversized) {
      setPhotoError(`⚠️ ${oversized.name} is too large. Max 5MB per photo.`);
      return;
    }
    setPhotoError("");
    setIsDirty(true);
    setPhotos((prev) => [...prev, ...imageFiles]);
    setPreviews((prev) => [...prev, ...imageFiles.map((f) => URL.createObjectURL(f))]);
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    addFiles(files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverZone(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  const removePhoto = (i: number) => {
    setPhotos(photos.filter((_, idx) => idx !== i));
    setPreviews(previews.filter((_, idx) => idx !== i));
    setIsDirty(true);
  };

  // FIX 1: Thumbnail drag-to-reorder
  const handleThumbDragStart = (i: number) => {
    dragIndexRef.current = i;
  };

  const handleThumbDrop = (dropIndex: number) => {
    const fromIndex = dragIndexRef.current;
    if (fromIndex === -1 || fromIndex === dropIndex) return;
    const newPhotos = [...photos];
    const newPreviews = [...previews];
    [newPhotos[fromIndex], newPhotos[dropIndex]] = [newPhotos[dropIndex], newPhotos[fromIndex]];
    [newPreviews[fromIndex], newPreviews[dropIndex]] = [newPreviews[dropIndex], newPreviews[fromIndex]];
    setPhotos(newPhotos);
    setPreviews(newPreviews);
    dragIndexRef.current = -1;
    setIsDirty(true);
  };

  const handleTypeChange = (newType: ListingType) => {
    if (newType === "rental" && !tcAccepted) {
      setPrevType(type);
      setShowTcModal(true);
      return;
    }
    setType(newType);
    setCategory(defaultCategoryForType(newType));
    setIsDirty(true);
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
    setFieldError(null);
    setLoading(true);

    if (userProfile?.isBlacklisted) {
      setError("Your account has been suspended. Please contact admin at cys2209204@xmu.edu.my for assistance.");
      setLoading(false);
      return;
    }

    if (!title.trim()) { setError("Title is required."); setLoading(false); return; }
    if (!description.trim()) { setError("Description is required."); setLoading(false); return; }
    if (type === "buy-sell" && priceCents <= 0) { setError("Please enter a price."); setLoading(false); return; }

    const countToCheck = realActiveCount !== null ? realActiveCount : (userProfile?.activeListingCount ?? 0);
    if (countToCheck >= 6) {
      setError("You've reached the maximum of 6 active listings. Delete an existing listing to free up a slot.");
      setLoading(false);
      return;
    }

    if (type === "rental") {
      if (photos.length < 2) {
        setError("Please upload at least 2 photos of the vehicle.");
        setLoading(false);
        return;
      }
      if (vehicleType !== "bicycle" && vehicleType !== "electric-bike" && (!vehicleBrand.trim() || !vehicleModel.trim() || !plateNumber.trim())) {
        setError("Please fill in all required vehicle details (Brand, Model, Plate Number).");
        setLoading(false);
        return;
      }
      if (rentalPricePerDayCents <= 0 && rentalPricePerHourCents <= 0) {
        setError("Please enter at least a per-day or per-hour rental price.");
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

    // FIX 4: Content filter with flaggedTerms
    const filterResult = checkContent(title, description);
    if (!filterResult.passed) {
      let errMsg = filterResult.reason ?? t.contentNotAllowed;
      if (filterResult.flaggedTerms?.length) {
        errMsg += ` (flagged: ${filterResult.flaggedTerms.join(", ")})`;
      }
      setError(errMsg);
      setFieldError("content");
      titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setLoading(false);
      return;
    }

    // Step 1: Upload photos first so we can pass URLs to AI moderation
    const uploadedUrls: string[] = [];
    setAiChecking(true);
    try {
      await withTimeout(auth.currentUser?.getIdToken(true) ?? Promise.resolve(""), 10_000, "token-refresh");
      for (const f of photos) {
        const url = await withTimeout(uploadPhoto(f, user.uid), 30_000, "photo-upload");
        uploadedUrls.push(url);
      }
    } catch (err: any) {
      setAiChecking(false);
      setLoading(false);
      const msg: string = err?.message ?? "";
      if (msg.startsWith("timeout:token-refresh")) setError("Session refresh timed out. Please sign out and sign back in.");
      else if (msg.startsWith("timeout:photo-upload")) setError("A photo upload timed out. Try a smaller image or check your connection.");
      else setError(err?.message ? `Error: ${err.message}` : t.errorOccurred);
      return;
    }

    // Step 2: Run AI moderation with text + uploaded photo URLs
    const aiResult = await moderateContent(
      `Title: ${title}\nDescription: ${description}`,
      "listing",
      uploadedUrls.length > 0 ? uploadedUrls : undefined
    );
    setAiChecking(false);

    if (aiResult.result === "BLOCKED") {
      // Delete the already-uploaded photos before aborting
      for (const url of uploadedUrls) {
        try {
          const path = decodeURIComponent(url.split("/o/")[1].split("?")[0]);
          deleteObject(storageRef(storage, path)).catch(() => {});
        } catch {
          // Non-fatal — best effort cleanup
        }
      }
      setError(
        aiResult.suggestion
          ? `${aiResult.reason} ${aiResult.suggestion}`
          : (aiResult.reason || "Your listing was flagged. Please review the content and try again.")
      );
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
      const now = Date.now();
      const baseData: Record<string, unknown> = {
        type, title, description,
        category, condition, photos: uploadedUrls,
        userId: user.uid, userEmail: user.email ?? "",
        userName: userProfile?.fullName ? getLastName(userProfile.fullName) : (user.email?.split("@")[0] ?? ""),
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
        if (vehicleType !== "bicycle" && vehicleType !== "electric-bike") {
          baseData.vehicleBrand = vehicleBrand.trim();
          baseData.vehicleModel = vehicleModel.trim();
          baseData.vehicleYear = vehicleYear;
          baseData.plateNumber = plateNumber.trim();
        }
        baseData.rentalPricePerDay = rentalPricePerDayCents / 100;
        if (rentalPricePerHourCents > 0) baseData.rentalPricePerHour = rentalPricePerHourCents / 100;
        baseData.depositAmount = depositCents / 100;
        if (availableFrom) baseData.availableFrom = new Date(availableFrom).getTime();
        if (availableTo) baseData.availableTo = new Date(availableTo).getTime();
        baseData.requiresLicense = requiresLicense;
        baseData.requiresInsuranceProof = requiresInsuranceProof;
        if (rentalTerms.trim()) baseData.rentalTerms = rentalTerms.trim();
        baseData.tcAcceptedAt = now;
        baseData.tcAcceptedVersion = "rental-tc-v1";
      }

      const listingId = await withTimeout(createListing(baseData as Parameters<typeof createListing>[0]), 12_000, "create-listing");

      // If AI-flagged, write the flag now that we have the real listingId
      if (aiResult.result === "FLAGGED") {
        void writeAiFlag({
          context: "listing",
          reason: aiResult.reason,
          content: `Title: ${title}\nDescription: ${description}`,
          listingId,
          listingTitle: title,
          userId: user?.uid ?? "",
          userEmail: user?.email ?? "",
          createdAt: Date.now(),
          status: "pending",
        });
      }

      // Increment activeListingCount
      try {
        await updateDoc(doc(db, "users", user.uid), {
          activeListingCount: increment(1),
        });
        setRealActiveCount(prev => (prev !== null ? prev + 1 : 1));
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

      setIsDirty(false);
      localStorage.removeItem(DRAFT_KEY);
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
    if (vt === "motorcycle") return `🏍️ ${t.rentalMotorcycle}`;
    if (vt === "bicycle") return `🚲 ${t.rentalBicycle}`;
    return `⚡ ${t.rentalElectricBike}`;
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="relative max-w-lg mx-auto px-4 py-5 pb-28 sm:pb-8 animate-in fade-in duration-200">
      {toast && <SuccessToast message={toast} onDone={() => navigate("/profile")} />}

      {showTcModal && (
        <RentalTcModal onAccept={handleTcAccepted} onCancel={handleTcCancelled} />
      )}

      {/* FIX 2: Live preview floating panel */}
      {showPreview && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[180px] pointer-events-none">
          <ListingCard listing={previewListing} />
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (isDirty && !window.confirm("Discard changes and go back?")) return;
          navigate("/");
        }}
        className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mb-4"
      >
        ← Cancel
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-display font-bold text-gray-900 dark:text-slate-100">{t.postItem}</h1>
        {/* FIX 2: Preview toggle */}
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors min-h-[36px] ${
            showPreview
              ? "bg-[#003366] dark:bg-blue-600 text-white border-[#003366] dark:border-blue-600"
              : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600"
          }`}
        >
          {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
          Preview
        </button>
      </div>

      {/* Type selector */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5 pb-1">
        {ALL_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => handleTypeChange(tab)}
            className={`chip flex-shrink-0 ${type === tab ? "chip-active" : ""}`}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* FIX 5: Draft banner — below type selector, above first field */}
        {draftBanner && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-4">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              📝 Draft saved {relativeTime(draftBanner.savedAt)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={restoreDraft}
                className="text-xs font-semibold text-amber-700 dark:text-amber-300 underline min-h-[44px]"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(DRAFT_KEY);
                  setDraftBanner(null);
                }}
                className="text-xs text-amber-500 min-h-[44px]"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* FIX 1: Drag-and-drop photo uploader */}
        <div>
          <label className={labelCls}>
            {type === "rental" ? `Photos (min 2, max 5) *` : t.photos}
          </label>
          {type === "rental" && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">{t.rentalPhotosNote}</p>
          )}

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
              dragOverZone
                ? "border-blue-400 bg-blue-50 dark:bg-slate-800"
                : "border-gray-300 dark:border-slate-600 hover:border-[#003366] dark:hover:border-blue-500"
            }`}
            onClick={() => fileRef.current?.click()}
            onDragEnter={(e) => { e.preventDefault(); setDragOverZone(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragOverZone(true); }}
            onDragLeave={() => setDragOverZone(false)}
            onDrop={handleDrop}
          >
            <ImagePlus size={24} className="mx-auto text-gray-400 dark:text-slate-500 mb-1" />
            <p className="text-xs text-gray-500 dark:text-slate-400">Drag photos here or tap to upload</p>
            <p className="text-[10px] text-gray-300 dark:text-slate-600 mt-0.5">
              {type === "rental" ? "Min 2 · Max 5 · 5 MB each" : "Up to 3 · Max 5 MB each"}
            </p>
          </div>

          {/* Photo error */}
          {photoError && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">{photoError}</p>
          )}

          {/* Thumbnail row */}
          {previews.length > 0 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {previews.map((src, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={() => handleThumbDragStart(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleThumbDrop(i)}
                  className="relative shrink-0 w-[72px] h-[72px] rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 cursor-grab active:cursor-grabbing"
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {photos.length < maxPhotos && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="shrink-0 w-[72px] h-[72px] rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:border-[#003366] dark:hover:border-blue-500 transition-colors text-xl"
                >
                  ➕
                </button>
              )}
            </div>
          )}

          {previews.length > 0 && (
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
              Photo {Math.min(previews.length, maxPhotos)} of {maxPhotos}
            </p>
          )}

          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
        </div>

        {/* Title */}
        <div>
          <label className={labelCls}>
            {(type === "jobs" || type === "assistance") ? t.serviceTitle : type === "rental" ? "Listing Title *" : t.title} *
          </label>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setIsDirty(true); setFieldError(null); }}
            onBlur={saveDraft}
            required
            maxLength={80}
            placeholder={
              type === "jobs" ? "e.g. Math Tutor Available" :
              type === "assistance" ? "e.g. Help Moving Dorm Room" :
              type === "rental" ? "e.g. 2020 Honda City Available for Rent" :
              ""
            }
            className={`${inputCls} ${fieldError === "content" ? "ring-2 ring-red-400" : ""}`}
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
                  onClick={() => { setJobSubtype(sub); setIsDirty(true); }}
                  className={`flex-1 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    jobSubtype === sub
                      ? "bg-[#003366] dark:bg-blue-600 text-white border-[#003366] dark:border-blue-600"
                      : "bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-[#003366] dark:hover:border-blue-500"
                  }`}
                >
                  {sub === "offering" ? `▶ ${t.jobSubtypeOffering}` : `◀ ${t.jobSubtypeSeeking}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Remote toggle for jobs */}
        {type === "jobs" && (
          <div className="flex items-center justify-between bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 min-h-[56px]">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">{t.availableRemotely}</p>
            </div>
            <button
              type="button"
              onClick={() => { setIsRemote(!isRemote); setIsDirty(true); }}
              className={`relative w-11 h-6 rounded-full transition-colors ${isRemote ? "bg-[#003366] dark:bg-blue-600" : "bg-gray-200 dark:bg-slate-500"}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isRemote ? "left-6" : "left-1"}`} />
            </button>
          </div>
        )}

        {/* Description */}
        <div>
          <label className={labelCls}>
            {t.descriptionLabel} *
          </label>
          <button
            type="button"
            onClick={() => setShowDescEditor(true)}
            className={`w-full text-left border rounded-xl px-3 py-2.5 text-sm min-h-[80px] bg-white dark:bg-slate-700 ${
              description ? "text-gray-900 dark:text-slate-100" : "text-gray-400 dark:text-slate-500"
            } ${fieldError === "content" ? "border-red-400 ring-2 ring-red-400" : "border-gray-300 dark:border-slate-600"}`}
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
            <div className={`text-right text-xs mt-1 font-medium ${description.length > 2700 ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-slate-500"}`}>
              {description.length} / 3000
            </div>
          )}
        </div>
        {showDescEditor && (
          <DescriptionEditorModal
            value={description}
            onChange={(val) => { setDescription(val); setIsDirty(true); setFieldError(null); }}
            onClose={() => setShowDescEditor(false)}
          />
        )}

        {/* Category */}
        <div>
          <label className={labelCls}>{t.category}</label>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setIsDirty(true); }} className={selectCls}>
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
                    onClick={() => { setVehicleType(vt); setIsDirty(true); }}
                    className={`py-2 rounded-xl text-xs font-semibold border min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                      vehicleType === vt
                        ? "bg-[#003366] dark:bg-blue-600 text-white border-transparent"
                        : "bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600"
                    }`}
                  >
                    <span className="text-lg">{vt === "car" ? "🚗" : vt === "bicycle" ? "🚲" : vt === "electric-bike" ? "⚡" : "🏍️"}</span>
                    <span className="text-[9px] capitalize">{vt}</span>
                  </button>
                ))}
              </div>
            </div>
            {vehicleType !== "bicycle" && vehicleType !== "electric-bike" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t.rentalBrandLabel} *</label>
                  <input type="text" value={vehicleBrand} onChange={(e) => { setVehicleBrand(e.target.value); setIsDirty(true); }} placeholder="e.g. Honda" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t.rentalModelLabel} *</label>
                  <input type="text" value={vehicleModel} onChange={(e) => { setVehicleModel(e.target.value); setIsDirty(true); }} placeholder="e.g. City" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t.rentalYearLabel}</label>
                  <input type="number" value={vehicleYear} onChange={(e) => { setVehicleYear(Number(e.target.value)); setIsDirty(true); }} min={1990} max={currentYear + 1} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t.rentalPlateNumber} *</label>
                  <input type="text" value={plateNumber} onChange={(e) => { setPlateNumber(e.target.value.toUpperCase()); setIsDirty(true); }} placeholder="e.g. PBJ 1234" className={`${inputCls} uppercase font-mono tracking-widest`} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Per Day (RM) <span className="text-gray-400 font-normal text-xs">(required if no hourly)</span></label>
                <CentsInput value={rentalPricePerDayCents} onChange={(v) => { setRentalPricePerDayCents(v); setIsDirty(true); }} />
              </div>
              <div>
                <label className={labelCls}>Per Hour (RM) <span className="text-gray-400 font-normal text-xs">(required if no daily)</span></label>
                <CentsInput value={rentalPricePerHourCents} onChange={(v) => { setRentalPricePerHourCents(v); setIsDirty(true); }} />
              </div>
              <div>
                <label className={labelCls}>{t.rentalDeposit} (RM) <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                <CentsInput value={depositCents} onChange={(v) => { setDepositCents(v); setIsDirty(true); }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t.rentalAvailableFromLabel} <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                <input type="date" value={availableFrom} onChange={(e) => { setAvailableFrom(e.target.value); setIsDirty(true); }} className={inputCls} min={new Date().toISOString().split("T")[0]} />
              </div>
              <div>
                <label className={labelCls}>{t.rentalAvailableToLabel} <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                <input type="date" value={availableTo} onChange={(e) => { setAvailableTo(e.target.value); setIsDirty(true); }} className={inputCls} min={availableFrom || new Date().toISOString().split("T")[0]} />
              </div>
            </div>
            {(vehicleType === "car" || vehicleType === "motorcycle") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 min-h-[52px]">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">{t.rentalLicenceRequired}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">For Renter</p>
                  </div>
                  <button type="button" onClick={() => { setRequiresLicense(!requiresLicense); setIsDirty(true); }} className={`relative w-11 h-6 rounded-full transition-colors ${requiresLicense ? "bg-[#003366] dark:bg-blue-600" : "bg-gray-200 dark:bg-slate-500"}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${requiresLicense ? "left-6" : "left-1"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 min-h-[52px]">
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">{t.rentalInsuranceRequired}</p>
                  <button type="button" onClick={() => { setRequiresInsuranceProof(!requiresInsuranceProof); setIsDirty(true); }} className={`relative w-11 h-6 rounded-full transition-colors ${requiresInsuranceProof ? "bg-[#003366] dark:bg-blue-600" : "bg-gray-200 dark:bg-slate-500"}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${requiresInsuranceProof ? "left-6" : "left-1"}`} />
                  </button>
                </div>
              </div>
            )}
            <div>
              <label className={labelCls}>{t.rentalSellerTerms} <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <textarea value={rentalTerms} onChange={(e) => { setRentalTerms(e.target.value.slice(0, 500)); setIsDirty(true); }} rows={3} className={`${inputCls} resize-none`} placeholder={t.rentalCustomTermsPlaceholder} />
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
                  onClick={() => { setCondition(c); setIsDirty(true); }}
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
              {type === "buy-sell" ? t.price : "Service Rate (RM)"}
              {type === "buy-sell" && <span className="ml-1 text-xs text-gray-400 font-normal">(enter 0 for free)</span>}
            </label>
            {type === "assistance" && (
              <div className="flex gap-2 mb-2">
                {(["per_hour", "per_day", "per_month", "fixed"] as const).map((model) => (
                  <button
                    key={model}
                    type="button"
                    onClick={() => { setPricingModel(model); setIsDirty(true); }}
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
            <CentsInput value={priceCents} onChange={(v) => { setPriceCents(v); setIsDirty(true); }} onBlur={saveDraft} />
            {priceCents > 50_000_000 && (
              <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                ⚠ Double-check — this is an unusually high price for a student marketplace.
              </p>
            )}
          </div>
        )}

        {/* Jobs: rate (optional) */}
        {type === "jobs" && (
          <div>
            <label className={labelCls}>{t.pricePerHour} <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <CentsInput value={priceCents} onChange={(v) => { setPriceCents(v); setIsDirty(true); }} onBlur={saveDraft} />
            {priceCents > 50_000_000 && (
              <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                ⚠ Double-check — this is an unusually high price for a student marketplace.
              </p>
            )}
          </div>
        )}

        {/* Availability (Assistance) */}
        {type === "assistance" && (
          <div>
            <label className={labelCls}>{t.availability} <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <input type="text" value={availability} onChange={(e) => { setAvailability(e.target.value); setIsDirty(true); }} placeholder={t.availabilityPlaceholder} className={inputCls} />
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
              onChange={(e) => { setMeetupSpot(e.target.value); setIsDirty(true); }}
              onBlur={saveDraft}
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
              onChange={(e) => { setWhatsapp(e.target.value); setWhatsappError(""); setIsDirty(true); }}
              onBlur={() => {
                saveDraft();
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
          <div>
            <label className={labelCls}>WeChat ID <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" value={wechat} onChange={(e) => { setWechat(e.target.value); setIsDirty(true); }} onBlur={saveDraft} placeholder="WeChat ID" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Microsoft Teams <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" value={teams} onChange={(e) => { setTeams(e.target.value); setIsDirty(true); }} placeholder="your@xmu.edu.my" className={inputCls} />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* FIX 6: Sticky submit button */}
        <div className="sticky bottom-0 z-20 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700 px-4 pt-3 pb-4 md:static md:bg-transparent md:border-0 md:p-0 md:mt-6 -mx-4">
          <div className="pointer-events-none absolute -top-6 left-0 right-0 h-6 bg-gradient-to-t from-white dark:from-slate-900 to-transparent md:hidden" />
          <button
            type="submit"
            disabled={loading || aiChecking}
            className="btn-primary w-full min-h-[56px] text-base disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] flex items-center justify-center gap-2"
          >
            {aiChecking ? (
              <><Loader2 size={20} className="animate-spin" /> Checking content…</>
            ) : loading ? (
              <><Loader2 size={20} className="animate-spin" /> {t.submitting}</>
            ) : (
              t.postItem
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
