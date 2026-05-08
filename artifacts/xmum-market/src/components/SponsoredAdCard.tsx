import { useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { SponsoredAd } from "@/lib/types";
import { recordAdImpression } from "@/lib/ads";

interface Props {
  ad: SponsoredAd;
}

export default function SponsoredAdCard({ ad }: Props) {
  useEffect(() => {
    recordAdImpression(ad.id);
  }, []); // fires once when the card appears in the feed

  const handleClick = () => {
    window.open(ad.ctaUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 shadow-sm px-3 py-2">
      <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted">
        <img
          src={ad.imageUrl}
          alt={ad.businessName}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
            Sponsored
          </span>
        </div>
        <p className="font-semibold text-xs text-gray-900 dark:text-slate-100 truncate">
          {ad.businessName}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-slate-400 line-clamp-1">
          {ad.tagline}
        </p>
      </div>

      <button
        onClick={handleClick}
        className="shrink-0 flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold py-1.5 px-3 rounded-lg transition-colors whitespace-nowrap min-h-[36px]"
      >
        {ad.ctaLabel}
        <ExternalLink className="w-3 h-3" />
      </button>
    </div>
  );
}
