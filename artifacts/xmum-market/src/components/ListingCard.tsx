import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Listing } from "@/lib/types";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Clock, Pencil, Wifi, Bookmark, BookmarkCheck, Eye, CheckCircle2 } from "lucide-react";
import AuthModal from "@/components/AuthModal";
import { saveListing, unsaveListing, isListingSaved } from "@/lib/savedListings";

interface Props {
  listing: Listing;
  onDelete?: () => void;
  showDelete?: boolean;
  showMarkSold?: boolean;
  onMarkSold?: () => void;
  showEdit?: boolean;
  onEdit?: () => void;
  showSaveButton?: boolean;
  onUnsave?: () => void;
  sellerVerified?: boolean;
}

const fmtRM = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return mins <= 1 ? "Just now" : mins + "m ago";
  if (hours < 24) return hours + "h ago";
  return days + "d ago";
}

function pricingModelSuffix(model: string | undefined, t: any): string {
  if (model === "per_hour") return t.perHourSuffix;
  if (model === "per_day") return t.perDaySuffix;
  if (model === "per_month") return t.perMonthSuffix;
  if (model === "fixed") return t.fixedSuffix;
  return "";
}

const VEHICLE_ICONS: Record<string, string> = {
  car: "🚗",
  bike: "🏍️",
  motorcycle: "🏍️",
  scooter: "🛵",
  bicycle: "🚲",
};

const TYPE_BORDER_COLOR: Record<string, string> = {
  "buy-sell":   "#003366",
  "lost-found": "#0D9488",
  "jobs":       "#7C3AED",
  "assistance": "#EA580C",
  "rental":     "#D97706",
};

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  "buy-sell":   { bg: "bg-[#003366]",  text: "text-white", label: "Buy & Sell" },
  "lost-found": { bg: "bg-teal-600",   text: "text-white", label: "Lost & Found" },
  "jobs":       { bg: "bg-purple-600", text: "text-white", label: "Jobs" },
  "assistance": { bg: "bg-orange-600", text: "text-white", label: "Assistance" },
  "rental":     { bg: "bg-amber-600",  text: "text-white", label: "Rental" },
};

export default function ListingCard({
  listing,
  onDelete,
  showDelete,
  showMarkSold,
  onMarkSold,
  showEdit,
  onEdit,
  showSaveButton = false,
  onUnsave,
  sellerVerified = false,
}: Props) {
  const { t } = useLang();
  const { user } = useAuth();
  const isSold = listing.status === "sold";
  const isOwnListing = !!user && user.uid === listing.userId;

  const catKey = listing.category as keyof typeof t.categories;
  const catLabel = t.categories[catKey] ?? listing.category;

  const isJobs = listing.type === "jobs";
  const isAssistance = listing.type === "assistance";
  const isRental = listing.type === "rental";

  const [isSaved, setIsSaved] = useState(false);
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  useEffect(() => {
    if (!showSaveButton || !user || isOwnListing) return;
    isListingSaved(user.uid, listing.id)
      .then(setIsSaved)
      .catch(() => {});
  }, [showSaveButton, user?.uid, listing.id, isOwnListing]);

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (isOwnListing || savingInProgress) return;
    setSavingInProgress(true);
    try {
      if (isSaved) {
        await unsaveListing(user.uid, listing.id);
        setIsSaved(false);
        setSaveToast("Removed from saved");
        onUnsave?.();
      } else {
        await saveListing(user.uid, listing);
        setIsSaved(true);
        setSaveToast("Saved to your collection");
      }
    } catch (err: any) {
      const code: string = err?.code ?? "";
      if (code === "permission-denied") {
        setSaveToast("Sign in with your XMUM email to save listings");
      } else {
        setSaveToast("Failed to save — check your connection");
      }
    } finally {
      setSavingInProgress(false);
      setTimeout(() => setSaveToast(null), 2800);
    }
  };

  const typeBadge = TYPE_BADGE[listing.type];
  const borderColor = TYPE_BORDER_COLOR[listing.type] ?? "#003366";

  return (
    <>
      {saveToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium px-4 py-2 rounded-xl shadow-xl pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
          {saveToast}
        </div>
      )}

      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-hover hover:scale-[1.015] transition-all duration-200 border-l-4"
        style={{ borderLeftColor: borderColor }}
      >
        <Link href={`/listing/${listing.id}`}>
          <div className="relative">
            {listing.photos.length > 0 ? (
              <img
                src={listing.photos[0]}
                alt={listing.title}
                className={`w-full aspect-[4/3] object-cover ${isSold ? "opacity-50" : ""}`}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                width={400}
                height={300}
              />
            ) : (
              <div className={`w-full aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex flex-col items-center justify-center gap-2 ${isSold ? "opacity-50" : ""}`}>
                {isRental && listing.vehicleType ? (
                  <span className="text-5xl">{VEHICLE_ICONS[listing.vehicleType] ?? "🚗"}</span>
                ) : (
                  <>
                    <svg className="w-10 h-10 text-slate-300 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span className="text-xs text-slate-400 dark:text-slate-500">No photo</span>
                  </>
                )}
              </div>
            )}

            {isSold && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-xl font-black tracking-[0.2em] uppercase drop-shadow-lg px-4 py-2 border-2 border-white/60 rounded-lg">
                  {listing.type === "lost-found" ? t.resolvedBadge : t.soldBadge}
                </span>
              </div>
            )}

            {/* TOP-LEFT: one primary status badge */}
            {!isSold && (() => {
              if (isJobs && listing.jobSubtype) {
                return (
                  <span className={`absolute top-2 left-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${listing.jobSubtype === "offering" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300"}`}>
                    {listing.jobSubtype === "offering" ? t.offeringBadge : t.seekingBadge}
                  </span>
                );
              }
              if (listing.type === "buy-sell") {
                return (
                  <span className={`absolute top-2 left-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${listing.condition === "new" ? "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"}`}>
                    {listing.condition === "new" ? t.conditionNew : t.conditionUsed}
                  </span>
                );
              }
              if (listing.type === "lost-found") {
                return (
                  <span className="absolute top-2 left-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                    {listing.category === "found" ? "Found" : "Lost"}
                  </span>
                );
              }
              if (isAssistance) {
                return (
                  <span className="absolute top-2 left-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300">
                    Help Wanted
                  </span>
                );
              }
              if (isRental) {
                return (
                  <span className="absolute top-2 left-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300 flex items-center gap-0.5">
                    {listing.vehicleType ? VEHICLE_ICONS[listing.vehicleType] : "🚗"} {t.rentalBadge}
                  </span>
                );
              }
              return null;
            })()}

            {/* TOP-RIGHT: one secondary badge (remote only) */}
            {!isSold && isJobs && listing.isRemote && (
              <span className="absolute top-2 right-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 flex items-center gap-0.5">
                <Wifi size={9} />
                {t.remoteBadge}
              </span>
            )}

            {/* BOTTOM-LEFT: type pill */}
            {!isSold && typeBadge && (
              <span className={`absolute bottom-2 left-2 z-10 inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${typeBadge.bg} ${typeBadge.text}`}>
                {isRental && listing.vehicleType ? `${VEHICLE_ICONS[listing.vehicleType] ?? "🚗"} ${typeBadge.label}` : typeBadge.label}
              </span>
            )}

            {/* BOTTOM-LEFT above type pill: bump badge */}
            {!isSold && listing.lastBumpedAt && Date.now() - listing.lastBumpedAt < 3 * 60 * 60 * 1000 && (
              <span className="absolute bottom-8 left-2 z-10 inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500 text-white shadow-sm">
                ⬆ Featured
              </span>
            )}

            {/* BOTTOM-RIGHT: save button */}
            {showSaveButton && !isOwnListing && (
              <button
                onClick={handleSaveToggle}
                disabled={savingInProgress}
                className="absolute bottom-2 right-2 z-10 w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors disabled:opacity-60"
                aria-label={isSaved ? "Remove from saved" : "Save listing"}
              >
                {isSaved
                  ? <BookmarkCheck size={16} className="text-white" />
                  : <Bookmark size={16} className="text-white" />
                }
              </button>
            )}
          </div>

          <div className="p-3">
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-500 mb-0.5">
              {isRental && listing.vehicleType
                ? `${VEHICLE_ICONS[listing.vehicleType] ?? ""} ${(t as any)[`rental${listing.vehicleType.charAt(0).toUpperCase() + listing.vehicleType.slice(1)}`] ?? listing.vehicleType}`
                : catLabel}
            </span>
            <h3 className={`font-semibold text-sm leading-snug line-clamp-1 ${isSold ? "text-[#64748B] dark:text-slate-500" : "text-[#0F172A] dark:text-slate-100"}`}>{listing.title}</h3>

            {typeof listing.viewCount === "number" && listing.viewCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                <Eye size={10} />
                {listing.viewCount}
              </span>
            )}

            <p className="text-xs text-[#64748B] dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">{listing.description}</p>

            {isJobs && listing.jobSubtype && (
              <p className="mt-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                {listing.jobSubtype === "offering" ? "▶ Offering" : "◀ Seeking"}
              </p>
            )}

            {listing.type === "buy-sell" && (
              <p className={`mt-2 text-lg font-bold ${isSold ? "text-gray-400 dark:text-slate-500 line-through" : "text-blue-600 dark:text-blue-400"}`}>
                {listing.price === 0 ? t.free : `${t.rmPrefix} ${fmtRM(listing.price ?? 0)}`}
              </p>
            )}

            {isJobs && listing.price != null && listing.price > 0 && (
              <p className={`mt-2 text-base font-bold ${isSold ? "text-gray-400 dark:text-slate-500 line-through" : "text-emerald-600 dark:text-emerald-400"}`}>
                {t.rmPrefix} {fmtRM(listing.price)} {t.perHourSuffix}
              </p>
            )}

            {isAssistance && listing.price != null && (
              <p className={`mt-2 text-base font-bold ${isSold ? "text-gray-400 dark:text-slate-500 line-through" : "text-orange-600 dark:text-orange-400"}`}>
                {t.rmPrefix} {fmtRM(listing.price)} {pricingModelSuffix(listing.pricingModel, t)}
              </p>
            )}

            {isRental && listing.rentalPricePerDay != null && (
              <p className={`mt-2 text-base font-bold ${isSold ? "text-gray-400 dark:text-slate-500 line-through" : "text-yellow-700 dark:text-yellow-400"}`}>
                {listing.vehicleType ? VEHICLE_ICONS[listing.vehicleType] : "🚗"} {t.rmPrefix} {fmtRM(listing.rentalPricePerDay)}/day
              </p>
            )}

            <div className="mt-2 flex items-center justify-between text-xs text-gray-400 dark:text-slate-500">
              {listing.meetupSpot ? (
                <span className="flex items-center gap-1 truncate">
                  <MapPin size={10} />
                  {listing.meetupSpot}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <MapPin size={10} />
                  {listing.type === "buy-sell" ? catLabel : listing.userEmail.split("@")[0]}
                </span>
              )}
              <span className="flex items-center gap-1 shrink-0 ml-2">
                <Clock size={10} />
                {relativeTime(listing.createdAt)}
              </span>
            </div>
          </div>
        </Link>

        <Link
          href={`/seller/${listing.userId}`}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="block px-3 py-1.5 text-[11px] text-gray-400 dark:text-slate-500 hover:text-[#003366] dark:hover:text-blue-400 transition-colors border-t border-gray-50 dark:border-slate-700/50"
        >
          <span className="flex items-center gap-1">
            by @{listing.userName}
            {sellerVerified && (
              <CheckCircle2 size={11} className="text-teal-500 dark:text-teal-400 shrink-0" />
            )}
          </span>
        </Link>

        {(showDelete || showMarkSold || showEdit) && (
          <div className="px-3 pb-3 flex flex-wrap gap-1.5">
            {showEdit && onEdit && !isSold && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="flex-1 min-h-[44px] text-xs text-gray-600 dark:text-slate-300 border border-gray-300 dark:border-slate-600 rounded-lg py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-medium flex items-center justify-center gap-1"
              >
                <Pencil size={12} />
                {t.editListing}
              </button>
            )}
            {showMarkSold && onMarkSold && !isSold && (
              <button
                onClick={(e) => { e.stopPropagation(); onMarkSold(); }}
                className="flex-1 min-h-[44px] text-xs text-[#003366] dark:text-blue-400 border border-[#003366]/30 dark:border-blue-500/30 rounded-lg py-1.5 hover:bg-[#003366]/5 dark:hover:bg-blue-500/10 transition-colors font-medium"
              >
                {listing.type === "lost-found" ? t.markAsResolved : t.markAsSold}
              </button>
            )}
            {isSold && showMarkSold && (
              <p className="text-xs text-center text-gray-400 dark:text-slate-500 py-1 w-full">
                {listing.type === "lost-found" ? t.resolvedBadge : t.soldBadge}
              </p>
            )}
            {showDelete && onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="flex-1 min-h-[44px] text-xs text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                {t.delete}
              </button>
            )}
          </div>
        )}
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  );
}
