import { useState, useRef, useEffect, useCallback } from "react";
import {
  collection, addDoc, getDocs, query, where, limit, updateDoc, doc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { X, CheckCircle2, Loader2, ChevronRight, ChevronLeft, ImagePlus, AlertCircle } from "lucide-react";

const SELLER_TC_VERSION = "seller-tc-v1";

const SHOP_CATEGORY_OPTIONS = [
  "Electronics", "Fashion", "Books", "Food & Beverage", "Beauty",
  "Services", "Sports", "Furniture", "Tutoring", "Others",
];

interface Props {
  initialStep?: 2 | 1;
  onClose: () => void;
  onSuccess: () => void;
}

function slugify(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

const inputCls = "w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition min-h-[44px]";
const labelCls = "block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1";

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            i + 1 < current ? "bg-green-500 text-white" :
            i + 1 === current ? "bg-[#003366] text-white" :
            "bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-slate-400"
          }`}>
            {i + 1 < current ? <CheckCircle2 size={14} /> : i + 1}
          </div>
          {i < total - 1 && <div className={`w-8 h-0.5 rounded-full transition-colors ${i + 1 < current ? "bg-green-400" : "bg-gray-200 dark:bg-slate-600"}`} />}
        </div>
      ))}
    </div>
  );
}

export default function ShopSetupModal({ initialStep = 1, onClose, onSuccess }: Props) {
  const { user, userProfile, refetchProfile } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialStep);
  const [confirmClose, setConfirmClose] = useState(false);

  // Step 1 — ID upload
  const [frontIdFile, setFrontIdFile] = useState<File | null>(null);
  const [backIdFile, setBackIdFile] = useState<File | null>(null);
  const [frontIdPreview, setFrontIdPreview] = useState<string | null>(null);
  const [backIdPreview, setBackIdPreview] = useState<string | null>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — Shop details
  const [shopName, setShopName] = useState(userProfile?.shopName ?? "");
  const [shopBio, setShopBio] = useState(userProfile?.shopBio ?? "");
  const [shopCategories, setShopCategories] = useState<string[]>(userProfile?.shopCategories ?? []);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(userProfile?.shopBannerUrl ?? null);
  const [shopSlug, setShopSlug] = useState(userProfile?.shopSlug ?? "");
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [slugOk, setSlugOk] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const slugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 3 — T&C
  const [tcAccepted, setTcAccepted] = useState(false);

  // Uploading state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [step1Error, setStep1Error] = useState("");
  const [step2Error, setStep2Error] = useState("");

  // Pre-fill slug from shop name
  useEffect(() => {
    if (!shopName || userProfile?.shopSlug) return;
    setShopSlug(slugify(shopName));
  }, [shopName]);

  const checkSlug = useCallback(async (val: string) => {
    const clean = slugify(val);
    if (!clean) { setSlugError("Slug cannot be empty."); setSlugOk(false); return; }
    if (clean.length < 3) { setSlugError("Slug must be at least 3 characters."); setSlugOk(false); return; }
    if (clean === userProfile?.shopSlug) { setSlugOk(true); setSlugError(""); return; }
    setSlugChecking(true);
    setSlugError("");
    setSlugOk(false);
    try {
      const q = query(collection(db, "users"), where("shopSlug", "==", clean), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setSlugError("This shop URL is already taken. Try another.");
        setSlugOk(false);
      } else {
        setSlugOk(true);
      }
    } catch {
      setSlugOk(true);
    } finally {
      setSlugChecking(false);
    }
  }, [userProfile?.shopSlug]);

  const handleSlugChange = (raw: string) => {
    const clean = slugify(raw);
    setShopSlug(clean);
    setSlugOk(false);
    setSlugError("");
    if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current);
    slugDebounceRef.current = setTimeout(() => checkSlug(clean), 500);
  };

  const handleIdFile = (side: "front" | "back", file: File) => {
    if (file.size > 5 * 1024 * 1024) { setStep1Error("ID image must be under 5 MB."); return; }
    if (!file.type.startsWith("image/")) { setStep1Error("Only image files are allowed."); return; }
    setStep1Error("");
    const url = URL.createObjectURL(file);
    if (side === "front") { setFrontIdFile(file); setFrontIdPreview(url); }
    else { setBackIdFile(file); setBackIdPreview(url); }
  };

  const handleBannerFile = (file: File) => {
    if (file.size > 3 * 1024 * 1024) { setStep2Error("Banner must be under 3 MB."); return; }
    if (!file.type.startsWith("image/")) { setStep2Error("Only image files are allowed."); return; }
    setStep2Error("");
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const handleTryClose = () => {
    if (step <= 3) setConfirmClose(true);
    else onClose();
  };

  const goToStep2 = () => {
    if (initialStep === 1 && (!frontIdFile || !backIdFile)) {
      setStep1Error("Please upload both front and back of your student ID.");
      return;
    }
    setStep1Error("");
    setStep(2);
  };

  const goToStep3 = async () => {
    if (!shopName.trim()) { setStep2Error("Shop name is required."); return; }
    if (!shopSlug.trim() || slugError) { setStep2Error("Please fix the shop URL before continuing."); return; }
    if (!slugOk && !userProfile?.shopSlug) { await checkSlug(shopSlug); if (slugError) return; }
    if (shopCategories.length === 0) { setStep2Error("Select at least one shop category."); return; }
    setStep2Error("");
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!tcAccepted) return;
    if (!user) return;
    setSubmitting(true);
    setSubmitError("");

    const now = Date.now();

    /** Race a promise against a ms timeout — resolves to null on timeout */
    function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
      return Promise.race([
        p.then((v) => v).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
      ]);
    }

    // T&C audit log — fire-and-forget, never blocks submission
    addDoc(collection(db, "sellerTcAuditLogs"), {
      userId: user.uid,
      userEmail: user.email ?? "",
      shopName: shopName.trim(),
      tcVersion: SELLER_TC_VERSION,
      acceptedAt: now,
      userAgent: navigator.userAgent,
    }).catch((err) => console.warn("[ShopSetup] T&C audit log failed:", err));

    try {
      // Student ID uploads — non-blocking with 15s timeout each.
      // If storage isn't configured or rules block the path, we still proceed.
      const uploadPromises: Promise<unknown>[] = [];
      if (frontIdFile) {
        uploadPromises.push(
          withTimeout(
            uploadBytes(ref(storage, `studentIds/${user.uid}/front.jpg`), frontIdFile),
            15_000,
          ),
        );
      }
      if (backIdFile) {
        uploadPromises.push(
          withTimeout(
            uploadBytes(ref(storage, `studentIds/${user.uid}/back.jpg`), backIdFile),
            15_000,
          ),
        );
      }
      // Run ID uploads in parallel without awaiting (truly non-blocking)
      Promise.all(uploadPromises).catch((err) =>
        console.warn("[ShopSetup] Student ID upload failed (non-fatal):", err),
      );

      // Banner upload — attempt with 15s timeout; failure is non-fatal
      let bannerUrl = userProfile?.shopBannerUrl;
      if (bannerFile) {
        try {
          const bannerRef = ref(storage, `shopBanners/${user.uid}/banner.jpg`);
          const result = await withTimeout(uploadBytes(bannerRef, bannerFile), 15_000);
          if (result) {
            const url = await withTimeout(getDownloadURL(bannerRef), 8_000);
            if (url) bannerUrl = url;
          }
        } catch (err) {
          console.warn("[ShopSetup] Banner upload failed (non-fatal):", err);
        }
      }

      const finalSlug = slugify(shopSlug) || slugify(shopName);

      // This is the critical write — mark user as pending in Firestore
      await Promise.race([
        updateDoc(doc(db, "users", user.uid), {
          shopName: shopName.trim(),
          shopSlug: finalSlug,
          shopBio: shopBio.trim(),
          shopCategories,
          ...(bannerUrl ? { shopBannerUrl: bannerUrl } : {}),
          verificationStatus: "pending",
          verificationSubmittedAt: now,
          sellerTcAcceptedAt: now,
          sellerTcVersion: SELLER_TC_VERSION,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 12_000),
        ),
      ]);

      refetchProfile().catch(() => {});
      setStep(4);
    } catch (err: any) {
      const code: string = err?.code ?? "";
      const msg: string = err?.message ?? "";
      if (msg === "timeout") {
        setSubmitError("Request timed out. Please check your internet connection and try again.");
      } else if (code === "permission-denied" || code === "PERMISSION_DENIED") {
        setSubmitError("Permission denied. Make sure your XMUM email is verified.");
      } else if (code.includes("storage/unauthorized")) {
        setSubmitError("Storage permission denied. Your email must be verified.");
      } else {
        setSubmitError(msg || "Submission failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    onSuccess();
    onClose();
  };

  return (
    <>
      {/* Backdrop — no click-to-close for steps 1–3 */}
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
              {step === 4 ? "Application Submitted!" : "Become a Verified Seller"}
            </h2>
            {step <= 3 ? (
              <button
                onClick={handleTryClose}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 transition-colors"
              >
                <X size={18} />
              </button>
            ) : (
              <button onClick={handleDone} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 transition-colors">
                <X size={18} />
              </button>
            )}
          </div>

          <div className="px-5 py-4">
            {step < 4 && <StepIndicator current={step} total={3} />}

            {/* ── STEP 1: Student ID ─────────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-slate-300">
                  Upload a clear photo of your XMUM student ID (front and back). Your ID will only be visible to admins.
                </p>

                {/* Front */}
                <div>
                  <label className={labelCls}>Front of Student ID *</label>
                  {frontIdPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600">
                      <img src={frontIdPreview} alt="Front ID" className="w-full h-40 object-cover" />
                      <button
                        onClick={() => { setFrontIdFile(null); setFrontIdPreview(null); }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => frontInputRef.current?.click()}
                      className="w-full h-36 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-slate-500 hover:border-[#003366] dark:hover:border-blue-500 transition-colors"
                    >
                      <ImagePlus size={24} />
                      <span className="text-xs">Tap to upload front</span>
                    </button>
                  )}
                  <input ref={frontInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleIdFile("front", f); e.target.value = ""; }} />
                </div>

                {/* Back */}
                <div>
                  <label className={labelCls}>Back of Student ID *</label>
                  {backIdPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600">
                      <img src={backIdPreview} alt="Back ID" className="w-full h-40 object-cover" />
                      <button
                        onClick={() => { setBackIdFile(null); setBackIdPreview(null); }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => backInputRef.current?.click()}
                      className="w-full h-36 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-slate-500 hover:border-[#003366] dark:hover:border-blue-500 transition-colors"
                    >
                      <ImagePlus size={24} />
                      <span className="text-xs">Tap to upload back</span>
                    </button>
                  )}
                  <input ref={backInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleIdFile("back", f); e.target.value = ""; }} />
                </div>

                {step1Error && (
                  <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 flex items-center gap-2">
                    <AlertCircle size={13} /> {step1Error}
                  </p>
                )}

                <button onClick={goToStep2} className="w-full min-h-[48px] bg-[#003366] dark:bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-[#002244] flex items-center justify-center gap-2 transition-colors">
                  Next: Shop Details <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* ── STEP 2: Shop Details ───────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Shop Name */}
                <div>
                  <label className={labelCls}>Shop Name *</label>
                  <input
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value.slice(0, 40))}
                    placeholder="e.g. Alex's Gadget Store"
                    className={inputCls}
                    maxLength={40}
                  />
                  <p className="text-right text-[10px] text-gray-400 mt-0.5">{shopName.length}/40</p>
                </div>

                {/* Shop URL slug */}
                <div>
                  <label className={labelCls}>Shop URL *</label>
                  <div className="flex items-center gap-0 border border-gray-300 dark:border-slate-600 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                    <span className="text-xs text-gray-400 px-3 bg-gray-50 dark:bg-slate-700 h-full flex items-center py-2.5 shrink-0 border-r border-gray-300 dark:border-slate-600">/shop/</span>
                    <input
                      type="text"
                      value={shopSlug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="your-shop-name"
                      className="flex-1 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2.5 text-sm focus:outline-none min-h-[44px]"
                      maxLength={40}
                    />
                    {slugChecking && <Loader2 size={14} className="animate-spin mr-2 text-gray-400 shrink-0" />}
                    {slugOk && !slugChecking && <CheckCircle2 size={14} className="mr-2 text-green-500 shrink-0" />}
                  </div>
                  {slugError && <p className="text-xs text-red-500 mt-1">{slugError}</p>}
                  {slugOk && <p className="text-xs text-green-500 mt-1">✓ This URL is available</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5">Lowercase letters, numbers, and hyphens only.</p>
                </div>

                {/* Shop Bio */}
                <div>
                  <label className={labelCls}>Shop Bio <span className="text-gray-400">(optional)</span></label>
                  <textarea
                    value={shopBio}
                    onChange={(e) => setShopBio(e.target.value.slice(0, 200))}
                    placeholder="Tell buyers what you sell and why they should shop with you…"
                    className={`${inputCls} min-h-[80px] resize-none`}
                    rows={3}
                  />
                  <p className="text-right text-[10px] text-gray-400 mt-0.5">{shopBio.length}/200</p>
                </div>

                {/* Categories */}
                <div>
                  <label className={labelCls}>Shop Categories * <span className="text-gray-400">(pick 1–3)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {SHOP_CATEGORY_OPTIONS.map((cat) => {
                      const sel = shopCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            if (sel) setShopCategories(shopCategories.filter((c) => c !== cat));
                            else if (shopCategories.length < 3) setShopCategories([...shopCategories, cat]);
                          }}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors min-h-[36px] ${
                            sel
                              ? "bg-[#003366] text-white border-[#003366]"
                              : "border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-[#003366] dark:hover:border-blue-500"
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Banner */}
                <div>
                  <label className={labelCls}>Shop Banner <span className="text-gray-400">(optional, 3:1 ratio recommended)</span></label>
                  {bannerPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600">
                      <img src={bannerPreview} alt="Banner" className="w-full h-28 object-cover" />
                      <button
                        onClick={() => { setBannerFile(null); setBannerPreview(null); }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      className="w-full h-28 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-slate-500 hover:border-[#003366] transition-colors"
                    >
                      <ImagePlus size={22} />
                      <span className="text-xs">Upload banner (max 3 MB)</span>
                    </button>
                  )}
                  <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBannerFile(f); e.target.value = ""; }} />
                </div>

                {step2Error && (
                  <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 flex items-center gap-2">
                    <AlertCircle size={13} /> {step2Error}
                  </p>
                )}

                <div className="flex gap-2">
                  {initialStep === 1 && (
                    <button onClick={() => setStep(1)} className="min-h-[48px] px-4 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm font-medium flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                      <ChevronLeft size={16} /> Back
                    </button>
                  )}
                  <button onClick={goToStep3} className="flex-1 min-h-[48px] bg-[#003366] dark:bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-[#002244] flex items-center justify-center gap-2 transition-colors">
                    Next: Review & Submit <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: T&C ───────────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200">Seller Terms & Conditions</h3>

                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 text-xs text-gray-600 dark:text-slate-300 space-y-2 max-h-56 overflow-y-auto border border-gray-200 dark:border-slate-600">
                  <p className="font-semibold">XMUM Market Verified Seller Agreement (v1.0)</p>
                  <p>By becoming a Verified Seller on XMUM Market, you agree to the following terms:</p>
                  <p><strong>1. Eligibility.</strong> You must be a current XMUM student with a valid @xmu.edu.my email address and a valid student ID.</p>
                  <p><strong>2. Authenticity.</strong> The student ID photos you upload must be genuine and unaltered. Submitting fraudulent documents will result in immediate permanent ban.</p>
                  <p><strong>3. Listings.</strong> As a Verified Seller, you may post up to 30 listings across all types (Buy & Sell, Lost & Found, Jobs, Assistance, Rental). Free accounts are limited to 5 listings in Buy & Sell and Lost & Found only.</p>
                  <p><strong>4. Conduct.</strong> You agree to respond to buyers in good faith, not engage in scams, and comply with PDPA data protection regulations.</p>
                  <p><strong>5. Shop Page.</strong> Your shop page will be publicly visible. You are responsible for keeping your shop information accurate.</p>
                  <p><strong>6. Revocation.</strong> XMUM Market admins may revoke verification at any time for violation of these terms or the platform's community guidelines.</p>
                  <p><strong>7. Privacy.</strong> Your student ID images are stored securely and are only accessible to XMUM Market admins for verification purposes.</p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <div
                    onClick={() => setTcAccepted(!tcAccepted)}
                    className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${tcAccepted ? "bg-[#003366] border-[#003366]" : "border-gray-300 dark:border-slate-500"}`}
                  >
                    {tcAccepted && <CheckCircle2 size={13} className="text-white" />}
                  </div>
                  <span className="text-sm text-gray-700 dark:text-slate-300">
                    I have read and agree to the XMUM Market Verified Seller Terms & Conditions.
                  </span>
                </label>

                {submitError && (
                  <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 flex items-center gap-2">
                    <AlertCircle size={13} /> {submitError}
                  </p>
                )}

                <div className="flex gap-2">
                  <button onClick={() => setStep(2)} className="min-h-[48px] px-4 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm font-medium flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!tcAccepted || submitting}
                    className="flex-1 min-h-[48px] bg-[#003366] dark:bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-[#002244] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {submitting ? <><Loader2 size={15} className="animate-spin" /> Submitting…</> : "Submit Application"}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 4: Success ────────────────────────────────────────── */}
            {step === 4 && (
              <div className="flex flex-col items-center text-center py-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 size={36} className="text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Application Submitted!</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Your shop application for <span className="font-semibold text-gray-700 dark:text-slate-300">{shopName}</span> has been submitted. Our admin team will review it within 24–48 hours.
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  You will receive a notification once your shop is approved or if we need additional information.
                </p>
                <button onClick={handleDone} className="w-full min-h-[48px] bg-[#003366] dark:bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-[#002244] transition-colors">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm close modal */}
      {confirmClose && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-xs shadow-2xl">
            <p className="font-bold text-gray-900 dark:text-slate-100 mb-1">Cancel application?</p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Your progress will be lost and you'll need to start over.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmClose(false)} className="flex-1 min-h-[44px] border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm font-medium">
                Keep going
              </button>
              <button onClick={onClose} className="flex-1 min-h-[44px] bg-red-500 text-white rounded-xl text-sm font-semibold">
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
