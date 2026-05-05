import { Link } from "wouter";
import { Listing } from "@/lib/types";
import { useLang } from "@/contexts/LanguageContext";
import { MapPin, Clock } from "lucide-react";

interface Props {
  listing: Listing;
  onDelete?: () => void;
  showDelete?: boolean;
}

export default function ListingCard({ listing, onDelete, showDelete }: Props) {
  const { t } = useLang();

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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <Link href={`/listing/${listing.id}`}>
        <div className="relative">
          {listing.photos.length > 0 ? (
            <img
              src={listing.photos[0]}
              alt={listing.title}
              className="w-full h-44 object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-44 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
              <span className="text-4xl">📦</span>
            </div>
          )}
          <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${listing.condition === "new" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {listing.condition === "new" ? t.conditionNew : t.conditionUsed}
          </span>
          {listing.type === "lost-found" && (
            <span className="absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              {catLabel}
            </span>
          )}
        </div>

        <div className="p-3">
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{listing.title}</h3>
          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{listing.description}</p>

          {listing.type === "buy-sell" && (
            <p className="mt-2 text-base font-bold text-[#003366]">
              {listing.price === 0 ? t.free : `${t.rmPrefix} ${listing.price?.toFixed(2)}`}
            </p>
          )}

          <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <MapPin size={10} />
              {listing.type === "buy-sell" ? catLabel : listing.userEmail.split("@")[0]}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {timeAgo(listing.createdAt)}
            </span>
          </div>
        </div>
      </Link>

      {showDelete && onDelete && (
        <div className="px-3 pb-3">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-full text-xs text-red-500 border border-red-200 rounded-lg py-1.5 hover:bg-red-50 transition-colors"
          >
            {t.delete}
          </button>
        </div>
      )}
    </div>
  );
}
