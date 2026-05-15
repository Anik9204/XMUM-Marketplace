import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getListing, markAsSold, getSimilarListings, deleteListing } from "@/lib/listings";
import ReportHoldModal from "@/components/ReportHoldModal";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getProfile } from "@/lib/userProfile";
import { Listing, UserProfile } from "@/lib/types";
import AuthModal from "@/components/AuthModal";
import ReportModal from "@/components/ReportModal";
import {
  ArrowLeft, Clock, Tag, CheckCircle2, MapPin, MessageCircle,
  Loader2, ShieldAlert, ShieldCheck, Bookmark, BookmarkCheck,
  MoreHorizontal, Flag, Share2, ChevronLeft, ChevronRight, X, Star,
  ArrowRight, Edit2, Trash2,
} from "lucide-react";
import { getOrCreateConversation } from "@/lib/messaging";
import { SiWhatsapp, SiWechat } from "react-icons/si";
import { MdGroups } from "react-icons/md";
import { useToast } from "@/hooks/use-toast";
import { saveListing, unsaveListing, isListingSaved } from "@/lib/savedListings";

const fmtRM = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return mins <= 1 ? "just now" : mins + "m ago";
  if (hours < 24) return hours + "h ago";
  return days + "d ago";
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

function memberSince(ms: number): string {
  return new Date(ms).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

const VEHICLE_ICONS: Record<string, string> = {
  car: "🚗",
  bike: "🏍️",
  motorcycle: "🏍️",
  scooter: "🛵",
  bicycle: "🚲",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={12}
          className={i <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200 dark:fill-slate-600 dark:text-slate-600"}
        />
      ))}
    </span>
  );
}

export default function ListingDetailPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const [, params] = useRoute("/listing/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [contactBlocked, setContactBlocked] = useState<string | null>(null);
  const [markingAsSold, setMarkingAsSold] = useState(false);
  const [soldToast, setSoldToast] = useState(false);
  const [deletingListing, setDeletingListing] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savingListing, setSavingListing] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdModalAction, setHoldModalAction] = useState<"delete" | "edit">("delete");

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(0);

  // Touch-swipe state for hero image
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Touch-swipe state for lightbox
  const lbTouchStartX = useRef<number | null>(null);

  // Similar listings
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  // Close overflow menu on outside click
  useEffect(() => {
    if (!showOverflowMenu) return;
    function handleClick(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showOverflowMenu]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [lightboxOpen]);

  // Check saved state when listing and user are ready
  useEffect(() => {
    if (!listing || !user || user.uid === listing.userId) return;
    isListingSaved(user.uid, listing.id).then(setIsSaved).catch(() => {});
  }, [listing?.id, user?.uid]);

  useEffect(() => {
    if (!params?.id) return;
    getListing(params.id)
      .then((l) => {
        setListing(l);
        if (l?.userId) {
          getProfile(l.userId)
            .then(setSellerProfile)
            .catch(() => setSellerProfile(null))
            .finally(() => setProfileLoading(false));
        } else {
          setProfileLoading(false);
        }
        // Fetch similar listings
        if (l) {
          setSimilarLoading(true);
          getSimilarListings(l.type, l.category, l.id)
            .then(setSimilarListings)
            .catch(() => setSimilarListings([]))
            .finally(() => setSimilarLoading(false));
        }
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  useEffect(() => {
    if (!listing || !listing.id) return;
    if (user?.uid === listing.userId) return;
    const timer = setTimeout(() => {
      updateDoc(doc(db, "listings", listing.id), { viewCount: increment(1) }).catch((err) => {
        console.warn("[viewCount] Failed to increment:", err?.code, err?.message);
      });
      setListing((prev) => prev ? { ...prev, viewCount: (prev.viewCount ?? 0) + 1 } : prev);
    }, 5000);
    return () => clearTimeout(timer);
  }, [listing?.id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="aspect-[4/3] bg-gray-100 dark:bg-slate-800 rounded-2xl" />
        <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-2/3" />
        <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-1/2" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="text-center py-20 text-gray-400 dark:text-slate-400">
        <p>Listing not found.</p>
        <button onClick={() => navigate("/")} className="mt-3 text-[#003366] dark:text-blue-400 underline text-sm">{t.home}</button>
      </div>
    );
  }

  const isSold = listing.status === "sold";
  const isOwner = user?.uid === listing.userId;
  const isRental = listing.type === "rental";
  const canViewPlate = isRental && user !== null && user.emailVerified === true;

  // Hero photo swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) setActivePhoto((p) => Math.min(p + 1, listing.photos.length - 1));
      else setActivePhoto((p) => Math.max(p - 1, 0));
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Lightbox swipe handlers
  const handleLbTouchStart = (e: React.TouchEvent) => {
    lbTouchStartX.current = e.touches[0].clientX;
  };
  const handleLbTouchEnd = (e: React.TouchEvent) => {
    if (lbTouchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - lbTouchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) setLightboxPhoto((p) => Math.min(p + 1, listing.photos.length - 1));
      else setLightboxPhoto((p) => Math.max(p - 1, 0));
    }
    lbTouchStartX.current = null;
  };

  const openLightbox = (idx: number) => {
    setLightboxPhoto(idx);
    setLightboxOpen(true);
  };

  const handleMessageSeller = async () => {
    if (!user || !listing) return;
    setChatError(null);
    setStartingChat(true);
    try {
      const convId = await getOrCreateConversation(user.uid, listing.userId, {
        id: listing.id,
        title: listing.title,
        photos: listing.photos,
      });
      const draft = encodeURIComponent(`Hi, I saw your post about "${listing.title}". Is it still available?`);
      navigate(`/messages?conv=${convId}&draft=${draft}`);
    } catch (err: any) {
      const code = err?.code ?? err?.message ?? "";
      if (code.includes("permission-denied") || code.includes("PERMISSION_DENIED")) {
        setChatError("Unable to start chat. Make sure you are signed in with your XMUM email and your email is verified.");
      } else {
        setChatError("Failed to open chat. Please try again.");
      }
    } finally {
      setStartingChat(false);
    }
  };

  const handleSaveToggle = async () => {
    if (!user || !listing) return;
    setSavingListing(true);
    try {
      if (isSaved) {
        await unsaveListing(user.uid, listing.id);
        setIsSaved(false);
        toast({ title: "Removed from saved", description: listing.title });
      } else {
        await saveListing(user.uid, listing);
        setIsSaved(true);
        toast({ title: "Saved to your collection", description: listing.title });
      }
    } catch (err: any) {
      const code: string = err?.code ?? "";
      if (code === "permission-denied") {
        toast({ title: "Permission denied", description: "Sign in with your XMUM email to save listings.", variant: "destructive" });
      } else {
        toast({ title: "Save failed", description: "Check your connection and try again.", variant: "destructive" });
      }
    } finally {
      setSavingListing(false);
    }
  };

  const handleDeleteListing = async () => {
    if (!listing || !confirm("Delete this listing? This cannot be undone.")) return;
    setDeletingListing(true);
    try {
      await deleteListing(listing);
      navigate("/profile");
    } catch (err: any) {
      if (err?.code === "report-hold") {
        setHoldModalAction("delete");
        setShowHoldModal(true);
      } else {
        console.error("[ListingDetailPage] delete error:", err);
        toast({ title: "Failed to delete listing. Please try again.", variant: "destructive" });
      }
    } finally {
      setDeletingListing(false);
    }
  };

  const handleMarkAsSold = async () => {
    if (!listing) return;
    setMarkingAsSold(true);
    try {
      await markAsSold(listing.id);
      setListing({ ...listing, status: "sold" });
      setSoldToast(true);
      setTimeout(() => setSoldToast(false), 3000);
    } finally {
      setMarkingAsSold(false);
    }
  };

  const handleShareListing = async () => {
    setShowOverflowMenu(false);
    const url = window.location.href;
    const shareData = {
      title: listing?.title ?? "Check out this listing on XMUM Market",
      text: listing?.description
        ? listing.description.slice(0, 120) + (listing.description.length > 120 ? "…" : "")
        : "Found on XMUM Market",
      url,
    };
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied to clipboard!", description: url });
    } catch {
      toast({ title: "Could not copy link", description: "Copy this URL: " + url, variant: "destructive" });
    }
  };

  const handleReportClick = () => {
    setShowOverflowMenu(false);
    if (!user) {
      toast({ title: "Sign in to report a listing", variant: "destructive" });
      return;
    }
    setShowReport(true);
  };

  const catKey = listing.category as keyof typeof t.categories;
  const catLabel = t.categories[catKey] ?? listing.category;
  const pre = encodeURIComponent(`Hi, I saw your listing "${listing.title}" on XMUM Market. Is it still available?`);

  const handleContact = (action: () => void) => {
    if (!user) { setContactBlocked("login"); return; }
    if (!user.emailVerified) { setContactBlocked("verify"); return; }
    action();
  };

  const canShowWhatsApp = listing.whatsapp && sellerProfile?.showWhatsApp !== false;
  const canShowWeChat  = listing.wechat  && sellerProfile?.showWeChat  !== false;
  const noContact = !canShowWhatsApp && !canShowWeChat && !listing.teams;

  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(listing.userName)}&background=003366&color=fff`;

  const whatsappUrl = (() => {
    const wa = listing.whatsapp ?? "";
    const num = wa.startsWith("+") ? wa.replace(/\+/, "").replace(/[^0-9]/g, "") : wa.replace(/[^0-9]/g, "");
    return `https://wa.me/${num}?text=${pre}`;
  })();

  return (
    <>
      {soldToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#003366] dark:bg-blue-700 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          <CheckCircle2 size={18} className="text-green-300 shrink-0" />
          {t.markedAsSold}
        </div>
      )}

      {/* ── Lightbox overlay ─────────────────────────────────────────────── */}
      {lightboxOpen && listing.photos.length > 0 && (
        <div
          className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
          onTouchStart={handleLbTouchStart}
          onTouchEnd={handleLbTouchEnd}
        >
          <img
            src={listing.photos[lightboxPhoto]}
            alt={listing.title}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />

          {/* Close */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={22} />
          </button>

          {/* Left arrow */}
          {lightboxPhoto > 0 && (
            <button
              onClick={() => setLightboxPhoto((p) => p - 1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Right arrow */}
          {lightboxPhoto < listing.photos.length - 1 && (
            <button
              onClick={() => setLightboxPhoto((p) => p + 1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          )}

          {/* Dot indicators */}
          {listing.photos.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {listing.photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxPhoto(i)}
                  className={`rounded-full transition-all ${i === lightboxPhoto ? "w-4 h-2 bg-white" : "w-2 h-2 border-2 border-white/60 bg-transparent"}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="max-w-2xl mx-auto pb-6 md:pb-8 animate-in fade-in duration-200">
        {/* Back button + overflow menu */}
        <div data-sticky-subheader className="sticky top-14 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between px-4">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 py-3 text-sm text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white min-h-[44px]"
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>

            <div className="relative" ref={overflowRef}>
              <button
                onClick={() => setShowOverflowMenu((v) => !v)}
                className="flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px] rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="More options"
              >
                <MoreHorizontal size={20} />
              </button>

              {showOverflowMenu && (
                <div className="absolute right-0 top-full mt-1 min-w-[200px] bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 overflow-hidden">
                  <button
                    onClick={handleReportClick}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left min-h-[44px]"
                  >
                    <Flag size={15} />
                    Report this listing
                  </button>
                  <button
                    onClick={handleShareListing}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left border-t border-gray-100 dark:border-slate-700 min-h-[44px]"
                  >
                    <Share2 size={15} />
                    Share listing
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rental disclaimer banner */}
        {isRental && (
          <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/50 border-b-2 border-red-300 dark:border-red-700 px-4 py-3">
            <ShieldAlert size={20} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-300 leading-snug font-medium">
              {t.rentalDisclaimerBanner}
            </p>
          </div>
        )}

        {/* ── Photo Gallery ─────────────────────────────────────────────────── */}
        <div
          className="relative bg-black overflow-hidden select-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {listing.photos.length > 0 ? (
            <>
              {/* Hero image — tappable to open lightbox */}
              <img
                src={listing.photos[activePhoto]}
                alt={listing.title}
                className={`w-full h-64 sm:h-80 md:h-96 object-contain cursor-zoom-in transition-opacity duration-150 ${isSold ? "opacity-50" : ""}`}
                onClick={() => openLightbox(activePhoto)}
                fetchPriority="high"
                loading="eager"
              />
              {isSold && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="bg-black/75 text-white text-2xl font-black tracking-widest px-6 py-3 rounded-2xl rotate-[-8deg] shadow-2xl">
                    {listing.type === "lost-found" ? t.resolvedBadge : t.soldBadge}
                  </span>
                </div>
              )}
              {/* Dot indicators */}
              {listing.photos.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
                  {listing.photos.map((_, i) => (
                    <span
                      key={i}
                      className={`rounded-full transition-all ${i === activePhoto ? "w-4 h-2 bg-white" : "w-2 h-2 border-2 border-white/60 bg-transparent"}`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className={`w-full h-64 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center ${isSold ? "opacity-50" : ""}`}>
              <span className="text-6xl">{isRental && listing.vehicleType ? VEHICLE_ICONS[listing.vehicleType] : "📦"}</span>
              {isSold && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-black/75 text-white text-2xl font-black tracking-widest px-6 py-3 rounded-2xl rotate-[-8deg] shadow-2xl">
                    {listing.type === "lost-found" ? t.resolvedBadge : t.soldBadge}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Thumbnail strip — 56×56px, active = navy ring */}
        {listing.photos.length > 1 && (
          <div className="flex gap-2 px-4 py-3 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700 overflow-x-auto scrollbar-hide">
            {listing.photos.map((src, i) => (
              <button
                key={i}
                onClick={() => setActivePhoto(i)}
                className={`w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${i === activePhoto ? "border-[#003366] dark:border-blue-400 ring-2 ring-[#003366]/30" : "border-transparent"}`}
              >
                <img src={src} alt={`${listing.title} photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}

        <div className="px-4 py-4 space-y-4">
          {/* Sold notice */}
          {isSold && (
            <div className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-center">
              <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">
                {listing.type === "lost-found" ? t.itemResolved : t.itemSold}
              </p>
            </div>
          )}

          {/* Title & price */}
          <div>
            <h1 className="text-xl font-display font-bold text-gray-900 dark:text-slate-100 leading-tight">{listing.title}</h1>
            {listing.type === "buy-sell" && (
              <p className={`mt-1 text-3xl font-bold ${isSold ? "text-gray-400 dark:text-slate-500 line-through" : "text-blue-600 dark:text-blue-400"}`}>
                {listing.price === 0 ? "Free / Return Item" : `RM ${fmtRM(listing.price ?? 0)}`}
              </p>
            )}
            {isRental && listing.rentalPricePerDay != null && (
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className={`text-3xl font-bold ${isSold ? "text-gray-400 dark:text-slate-500 line-through" : "text-yellow-700 dark:text-yellow-400"}`}>
                  RM {fmtRM(listing.rentalPricePerDay)}{t.rentalPerDay}
                </p>
                {listing.rentalPricePerHour != null && (
                  <p className="text-base font-semibold text-yellow-600 dark:text-yellow-500">
                    RM {fmtRM(listing.rentalPricePerHour)} / hr
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {isRental && listing.vehicleType ? (
                <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded-full font-medium">
                  {VEHICLE_ICONS[listing.vehicleType]} {t.rentalBadge}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 px-2 py-1 rounded-full">
                  <Tag size={10} />{catLabel}
                </span>
              )}
              {!isRental && (
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${listing.condition === "new" ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                  {listing.condition === "new" ? t.conditionNew : t.conditionUsed}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
                <Clock size={10} />Listed {relativeTime(listing.createdAt)}
              </span>
            </div>
          </div>

          {/* Rental: Vehicle info card */}
          {isRental && (
            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-bold text-gray-800 dark:text-slate-200">{t.rentalVehicleInfo}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {listing.vehicleBrand && (
                  <div>
                    <span className="text-xs text-gray-400 dark:text-slate-500 block">{t.rentalBrandLabel}</span>
                    <span className="font-semibold text-gray-800 dark:text-slate-200">{listing.vehicleBrand}</span>
                  </div>
                )}
                {listing.vehicleModel && (
                  <div>
                    <span className="text-xs text-gray-400 dark:text-slate-500 block">{t.rentalModelLabel}</span>
                    <span className="font-semibold text-gray-800 dark:text-slate-200">{listing.vehicleModel}</span>
                  </div>
                )}
                {listing.vehicleYear && (
                  <div>
                    <span className="text-xs text-gray-400 dark:text-slate-500 block">{t.rentalYearLabel}</span>
                    <span className="font-semibold text-gray-800 dark:text-slate-200">{listing.vehicleYear}</span>
                  </div>
                )}
                <div>
                  <span className="text-xs text-gray-400 dark:text-slate-500 block">{t.rentalPlateNumber}</span>
                  {canViewPlate ? (
                    <span className="font-mono font-bold text-gray-900 dark:text-slate-100 tracking-widest">
                      {listing.plateNumber}
                    </span>
                  ) : (
                    <span className="text-xs text-blue-600 dark:text-blue-400 italic">
                      {t.rentalSignInForPlate}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-yellow-200 dark:border-yellow-800">
                <p className="text-sm font-bold text-gray-800 dark:text-slate-200 mb-2">{t.rentalPricingInfo}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {listing.rentalPricePerDay != null && (
                    <div>
                      <span className="text-xs text-gray-400 dark:text-slate-500 block">Per Day</span>
                      <span className="font-bold text-yellow-700 dark:text-yellow-400">RM {fmtRM(listing.rentalPricePerDay)}</span>
                    </div>
                  )}
                  {listing.rentalPricePerHour != null && (
                    <div>
                      <span className="text-xs text-gray-400 dark:text-slate-500 block">Per Hour</span>
                      <span className="font-bold text-yellow-700 dark:text-yellow-400">RM {fmtRM(listing.rentalPricePerHour)}</span>
                    </div>
                  )}
                  {listing.depositAmount != null && (
                    <div>
                      <span className="text-xs text-gray-400 dark:text-slate-500 block">{t.rentalDeposit}</span>
                      <span className="font-semibold text-gray-800 dark:text-slate-200">RM {fmtRM(listing.depositAmount)}</span>
                    </div>
                  )}
                  {listing.availableFrom && listing.availableTo && (
                    <div className="col-span-2">
                      <span className="text-xs text-gray-400 dark:text-slate-500 block">{t.rentalAvailability}</span>
                      <span className="font-semibold text-gray-800 dark:text-slate-200">
                        {formatDate(listing.availableFrom)} — {formatDate(listing.availableTo)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-yellow-200 dark:border-yellow-800 flex flex-wrap gap-2">
                {listing.requiresLicense && (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 px-2 py-1 rounded-full font-medium">
                    <ShieldCheck size={11} /> {t.rentalLicenceRequired}
                  </span>
                )}
                {listing.requiresInsuranceProof && (
                  <span className="inline-flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full font-medium">
                    <ShieldCheck size={11} /> {t.rentalInsuranceRequired}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Rental: custom seller terms */}
          {isRental && listing.rentalTerms && (
            <div className="border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1.5">{t.rentalSellerTerms}</p>
              <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{listing.rentalTerms}</p>
            </div>
          )}

          {/* Description */}
          <div>
            <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{listing.description}</p>
          </div>

          {/* Meet-up spot */}
          {listing.meetupSpot && (
            <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-3 py-1.5 text-sm">
              <MapPin size={13} /> {listing.meetupSpot}
            </span>
          )}

          {/* ── Seller Card ────────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden border-t-4 border-t-[#003366]">
            <div className="p-4">
              {user ? (
                <>
                  <div className="flex items-center gap-3">
                    <img
                      src={sellerProfile?.avatarUrl || avatarFallback}
                      alt={listing.userName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-slate-600 shadow-sm shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{listing.userName}</p>
                      {sellerProfile?.isVerified ? (
                        <p className="text-[11px] font-display font-medium text-teal-600 dark:text-teal-400 flex items-center gap-1">
                          <ShieldCheck size={11} /> Verified XMUM Student
                        </p>
                      ) : null}
                      <div className="flex items-center gap-2 mt-0.5">
                        {sellerProfile?.rating != null && sellerProfile.rating > 0 && (
                          <StarRating rating={sellerProfile.rating} />
                        )}
                        {sellerProfile?.createdAt && (
                          <span className="text-[11px] text-gray-400 dark:text-slate-500">
                            Member since {memberSince(sellerProfile.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    {!isOwner && user.emailVerified && (
                      <button
                        onClick={handleMessageSeller}
                        disabled={startingChat}
                        className="btn-primary flex-1 flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50"
                      >
                        {startingChat ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
                        Message
                      </button>
                    )}
                    {!isOwner && (
                      <Link
                        href={`/seller/${listing.userId}`}
                        className="flex-1 flex items-center justify-center gap-2 border-2 border-[#003366] dark:border-blue-500 text-[#003366] dark:text-blue-400 text-sm font-semibold rounded-xl py-2.5 min-h-[44px] hover:bg-[#003366]/5 dark:hover:bg-blue-500/10 transition-colors"
                      >
                        View Profile <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-slate-700 blur-sm" />
                  <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">Sign in to see seller details</p>
                  <button
                    onClick={() => setShowAuth(true)}
                    className="btn-primary px-5 py-2 text-sm"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Owner: Mark as Sold + Edit + Delete */}
          {isOwner && !isSold && (
            <button
              onClick={handleMarkAsSold}
              disabled={markingAsSold}
              className="w-full min-h-[44px] border-2 border-[#003366] dark:border-blue-500 text-[#003366] dark:text-blue-400 rounded-xl py-2.5 text-sm font-semibold hover:bg-[#003366]/5 dark:hover:bg-blue-500/10 disabled:opacity-50 transition-colors"
            >
              {markingAsSold ? "Updating..." : (listing.type === "lost-found" ? t.markAsResolved : t.markAsSold)}
            </button>
          )}
          {isOwner && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (listing.isReportHeld === true) {
                    setHoldModalAction("edit");
                    setShowHoldModal(true);
                    return;
                  }
                  navigate(`/edit/${listing.id}`);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Edit2 size={14} /> Edit
              </button>
              <button
                onClick={handleDeleteListing}
                disabled={deletingListing}
                className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 rounded-xl text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
              >
                {deletingListing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          )}

          {/* Contact blocked notice */}
          {!isSold && contactBlocked && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
              {contactBlocked === "login" ? (
                <span>{t.loginToContact}{" "}
                  <button onClick={() => setShowAuth(true)} className="underline font-semibold">{t.signIn}</button>
                </span>
              ) : t.verifyToContact}
            </div>
          )}

          {/* Contact buttons (in-page, desktop-friendly) */}
          {!isSold && (
            <div>
              {chatError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 mb-2">
                  {chatError}
                </p>
              )}

              {/* Save listing button — non-owners only */}
              {user && !isOwner && (
                <button
                  onClick={handleSaveToggle}
                  disabled={savingListing}
                  className={`w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl text-sm font-semibold border transition-colors mb-3 disabled:opacity-50 ${
                    isSaved
                      ? "bg-[#003366]/8 border-[#003366]/30 dark:border-blue-500/30 text-[#003366] dark:text-blue-400 hover:bg-[#003366]/10"
                      : "border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {savingListing
                    ? <Loader2 size={15} className="animate-spin" />
                    : isSaved
                      ? <BookmarkCheck size={15} className="text-[#003366] dark:text-blue-400" />
                      : <Bookmark size={15} />
                  }
                  {isSaved ? "Saved" : "Save Listing"}
                </button>
              )}

              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">{t.contactSeller}</p>
              {profileLoading ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
                  <div className="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  {canShowWhatsApp && (
                    <button
                      onClick={() => handleContact(() => {
                        const wa = listing.whatsapp ?? "";
                        const num = wa.startsWith("+") ? wa.replace(/\+/, "").replace(/[^0-9]/g, "") : wa.replace(/[^0-9]/g, "");
                        window.open(`https://wa.me/${num}?text=${pre}`, "_blank");
                      })}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto flex-1 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 rounded-xl py-3 min-h-[44px] hover:bg-[#25D366]/20 transition-colors"
                    >
                      <SiWhatsapp size={20} />
                      <span className="text-sm font-medium">
                        {t.contactViaWhatsApp}
                        {listing.whatsapp && !listing.whatsapp.trim().startsWith("+") && (
                          <span title="This number may be missing a country code." className="ml-1">⚠️</span>
                        )}
                      </span>
                    </button>
                  )}
                  {canShowWeChat && (
                    <button
                      onClick={() => handleContact(() => { navigator.clipboard.writeText(listing.wechat ?? ""); alert(`WeChat ID copied: ${listing.wechat}`); })}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto flex-1 bg-[#09B83E]/10 text-[#09B83E] border border-[#09B83E]/20 rounded-xl py-3 min-h-[44px] hover:bg-[#09B83E]/20 transition-colors"
                    >
                      <SiWechat size={20} />
                      <span className="text-sm font-medium">{t.contactViaWeChat}</span>
                    </button>
                  )}
                  {listing.teams && !isRental && (
                    <button
                      onClick={() => handleContact(() => window.open(`https://teams.microsoft.com/l/chat/0/0?users=${listing.teams}&message=${pre}`, "_blank"))}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto flex-1 bg-[#6264A7]/10 text-[#6264A7] border border-[#6264A7]/20 rounded-xl py-3 min-h-[44px] hover:bg-[#6264A7]/20 transition-colors"
                    >
                      <MdGroups size={20} />
                      <span className="text-sm font-medium">{t.contactViaTeams}</span>
                    </button>
                  )}
                  {noContact && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-2">No contact info provided.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Similar Listings ──────────────────────────────────────────── */}
          {(similarLoading || similarListings.length >= 2) && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-header">More in {catLabel}</h2>
                <Link
                  href={`/search?category=${listing.category}&type=${listing.type}`}
                  className="flex items-center gap-1 text-xs text-[#003366] dark:text-blue-400 font-medium hover:underline"
                >
                  See all <ArrowRight size={12} />
                </Link>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                {similarLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex-shrink-0 w-40 md:w-48 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse aspect-[3/4]" />
                    ))
                  : similarListings.map((sl) => (
                      <Link
                        key={sl.id}
                        href={`/listing/${sl.id}`}
                        className="flex-shrink-0 w-40 md:w-48 card-base overflow-hidden hover:scale-[1.02] transition-all duration-200"
                      >
                        {sl.photos.length > 0 ? (
                          <img
                            src={sl.photos[0]}
                            alt={sl.title}
                            className="w-full aspect-[4/3] object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full aspect-[4/3] bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-3xl">
                            📦
                          </div>
                        )}
                        <div className="p-2">
                          <p className="text-xs font-display font-semibold text-gray-900 dark:text-slate-100 line-clamp-2 leading-snug">{sl.title}</p>
                          {sl.price != null && sl.type === "buy-sell" && (
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1">
                              {sl.price === 0 ? "Free" : `RM ${fmtRM(sl.price)}`}
                            </p>
                          )}
                          {sl.type === "rental" && sl.rentalPricePerDay != null && (
                            <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400 mt-1">
                              RM {fmtRM(sl.rentalPricePerDay)}/day
                            </p>
                          )}
                        </div>
                      </Link>
                    ))
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showReport && listing && (
        <ReportModal listing={listing} onClose={() => setShowReport(false)} />
      )}
      {showHoldModal && (
        <ReportHoldModal action={holdModalAction} onClose={() => setShowHoldModal(false)} />
      )}
    </>
  );
}
