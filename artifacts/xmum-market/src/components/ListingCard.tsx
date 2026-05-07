import { Link } from "wouter";
import { Listing } from "@/lib/types";
import { useLang } from "@/contexts/LanguageContext";
import { MapPin, Clock, Pencil } from "lucide-react";

interface Props {
  listing: Listing;
  onDelete?: () => void;
  showDelete?: boolean;
  showMarkSold?: boolean;
  onMarkSold?: () => void;
  showEdit?: boolean;
  onEdit?: () => void;
}

export default function ListingCard({ listing, onDelete, showDelete, showMarkSold, onMarkSold, showEdit, onEdit }: Props) {
  const { t } = useLang();
  const isSold = listing.status === "sold";

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const catKey = listing.category as keyof typeof t.categories;
  const catLabel = t.categories[catKey] ?? listing.category;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow">
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
            <div className={`w-full aspect-[4/3] bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center ${isSold ? "opacity-50" : ""}`}>
              <span className="text-4xl">📦</span>
            </div>
          )}

          {/* SOLD / RESOLVED badge */}
          {isSold && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-black/70 text-white text-xs font-bold tracking-widest px-3 py-1.5 rounded-full rotate-[-8deg] shadow-lg">
                {listing.type === "lost-found" ? t.resolvedBadge : t.soldBadge}
              </span>
            </div>
          )}

          {!isSold && (
            <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${listing.condition === "new" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {listing.condition === "new" ? t.conditionNew : t.conditionUsed}
            </span>
          )}
          {listing.type === "lost-found" && !isSold && (
            <span className="absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              {catLabel}
            </span>
          )}
        </div>

        <div className="p-3">
          {listing.type === "buy-sell" && !isSold && (
            <span className="inline-block text-[9px] font-semibold uppercase tracking-wide text-[#003366]/70 dark:text-blue-400/70 mb-0.5">
              {catLabel}
            </span>
          )}
          <h3 className={`font-semibold text-sm line-clamp-1 ${isSold ? "text-gray-400 dark:text-slate-500" : "text-gray-900 dark:text-slate-100"}`}>{listing.title}</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2 mt-0.5">{listing.description}</p>

          {listing.type === "buy-sell" && (
            <p className={`mt-2 text-base font-semibold ${isSold ? "text-gray-400 dark:text-slate-500 line-through" : "text-[#003366] dark:text-blue-400"}`}>
              {listing.price === 0 ? t.free : `${t.rmPrefix} ${listing.price?.toFixed(2)}`}
            </p>
          )}

          <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500">
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
              {timeAgo(listing.createdAt)}
            </span>
          </div>
        </div>
      </Link>

      {/* Owner action buttons */}
      {(showDelete || showMarkSold || showEdit) && (
        <div className={`px-3 pb-3 flex gap-2 ${(showDelete || showMarkSold || showEdit) ? "flex-col" : ""}`}>
          {showEdit && onEdit && !isSold && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="w-full min-h-[44px] text-xs text-gray-600 dark:text-slate-300 border border-gray-300 dark:border-slate-600 rounded-lg py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-medium flex items-center justify-center gap-1"
            >
              <Pencil size={12} />
              {t.editListing}
            </button>
          )}
          {showMarkSold && onMarkSold && !isSold && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkSold(); }}
              className="w-full min-h-[44px] text-xs text-[#003366] dark:text-blue-400 border border-[#003366]/30 dark:border-blue-500/30 rounded-lg py-1.5 hover:bg-[#003366]/5 dark:hover:bg-blue-500/10 transition-colors font-medium"
            >
              {listing.type === "lost-found" ? t.markAsResolved : t.markAsSold}
            </button>
          )}
          {isSold && showMarkSold && (
            <p className="text-xs text-center text-gray-400 dark:text-slate-500 py-1">
              {listing.type === "lost-found" ? t.resolvedBadge : t.soldBadge}
            </p>
          )}
          {showDelete && onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-full min-h-[44px] text-xs text-red-500 border border-red-200 dark:border-red-800 rounded-lg py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              {t.delete}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
