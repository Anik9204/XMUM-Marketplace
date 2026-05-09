import { Link } from "wouter";
import { Listing } from "@/lib/types";
import { useLang } from "@/contexts/LanguageContext";
import { MapPin, Clock, Pencil, Wifi } from "lucide-react";

interface Props {
  listing: Listing;
  onDelete?: () => void;
  showDelete?: boolean;
  showMarkSold?: boolean;
  onMarkSold?: () => void;
  showEdit?: boolean;
  onEdit?: () => void;
}

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

export default function ListingCard({ listing, onDelete, showDelete, showMarkSold, onMarkSold, showEdit, onEdit }: Props) {
  const { t } = useLang();
  const isSold = listing.status === "sold";

  const catKey = listing.category as keyof typeof t.categories;
  const catLabel = t.categories[catKey] ?? listing.category;

  const isJobs = listing.type === "jobs";
  const isAssistance = listing.type === "assistance";
  const isRental = listing.type === "rental";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200">
      <Link href={`/listing/${listing.id}`}>
        <div className="relative">
          {listing.photos.length > 0 ? (
            <img
              src={listing.photos[0]}
              alt={listing.title}
              className={`w-full aspect-[4/3] object-cover ${isSold ? "opacity-50" : ""}`}
              loading="lazy"
              decoding="async"
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
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-lg font-bold tracking-widest">
                {listing.type === "lost-found" ? t.resolvedBadge : t.soldBadge}
              </span>
            </div>
          )}

          {!isSold && (
            <>
              {listing.type === "buy-sell" && (
                <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                  For Sale
                </span>
              )}
              {listing.type === "lost-found" && (
                <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                  Lost &amp; Found
                </span>
              )}
              {isJobs && listing.jobSubtype && (
                <span className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${listing.jobSubtype === "offering" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300"}`}>
                  {listing.jobSubtype === "offering" ? t.offeringBadge : t.seekingBadge}
                </span>
              )}
              {isJobs && listing.isRemote && (
                <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 flex items-center gap-0.5">
                  <Wifi size={9} />
                  {t.remoteBadge}
                </span>
              )}
              {isAssistance && (
                <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300">
                  Assistance
                </span>
              )}
              {isRental && (
                <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300 flex items-center gap-0.5">
                  {listing.vehicleType ? VEHICLE_ICONS[listing.vehicleType] : "🚗"} {t.rentalBadge}
                </span>
              )}
              {listing.type === "buy-sell" && (
                <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${listing.condition === "new" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {listing.condition === "new" ? t.conditionNew : t.conditionUsed}
                </span>
              )}
            </>
          )}
        </div>

        <div className="p-3">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-[#003366]/70 dark:text-blue-400/70 mb-0.5">
            {isRental && listing.vehicleType
              ? `${VEHICLE_ICONS[listing.vehicleType] ?? ""} ${(t as any)[`rental${listing.vehicleType.charAt(0).toUpperCase() + listing.vehicleType.slice(1)}`] ?? listing.vehicleType}`
              : catLabel}
          </span>
          <h3 className={`font-semibold text-sm line-clamp-1 ${isSold ? "text-gray-400 dark:text-slate-500" : "text-gray-900 dark:text-slate-100"}`}>{listing.title}</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2 mt-0.5">{listing.description}</p>

          {listing.type === "buy-sell" && (
            <p className={`mt-2 text-lg font-bold ${isSold ? "text-gray-400 dark:text-slate-500 line-through" : "text-blue-600 dark:text-blue-400"}`}>
              {listing.price === 0 ? t.free : `${t.rmPrefix} ${listing.price?.toFixed(2)}`}
            </p>
          )}

          {isJobs && listing.price != null && listing.price > 0 && (
            <p className={`mt-2 text-base font-bold ${isSold ? "text-gray-400 dark:text-slate-500 line-through" : "text-emerald-600 dark:text-emerald-400"}`}>
              {t.rmPrefix} {listing.price.toFixed(2)} {t.perHourSuffix}
            </p>
          )}

          {isAssistance && listing.price != null && (
            <p className={`mt-2 text-base font-bold ${isSold ? "text-gray-400 dark:text-slate-500 line-through" : "text-orange-600 dark:text-orange-400"}`}>
              {t.rmPrefix} {listing.price.toFixed(2)} {pricingModelSuffix(listing.pricingModel, t)}
            </p>
          )}

          {isRental && listing.rentalPricePerDay != null && (
            <p className={`mt-2 text-base font-bold ${isSold ? "text-gray-400 dark:text-slate-500 line-through" : "text-yellow-700 dark:text-yellow-400"}`}>
              {t.rmPrefix} {listing.rentalPricePerDay.toFixed(2)}{t.rentalPerDay}
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

      {/* Seller attribution — tappable link to seller's public profile */}
      <Link
        href={`/seller/${listing.userId}`}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="block px-3 py-1.5 text-[11px] text-gray-400 dark:text-slate-500 hover:text-[#003366] dark:hover:text-blue-400 transition-colors border-t border-gray-50 dark:border-slate-700/50"
      >
        by @{listing.userName}
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
  );
}
