import { ExternalLink } from "lucide-react";
import { SponsoredAd } from "@/lib/types";

interface Props {
  ad: SponsoredAd;
}

export default function SponsoredAdCard({ ad }: Props) {
  const handleClick = () => {
    window.open(ad.ctaUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 shadow-sm">
      <div className="absolute top-2 left-2 z-10">
        <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
          Sponsored
        </span>
      </div>

      <div className="aspect-[4/3] w-full bg-muted overflow-hidden">
        <img
          src={ad.imageUrl}
          alt={ad.businessName}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="p-3">
        <p className="font-semibold text-sm text-gray-900 dark:text-slate-100">
          {ad.businessName}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">
          {ad.tagline}
        </p>
        <button
          onClick={handleClick}
          className="mt-3 w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold py-2 px-3 rounded-xl transition-colors min-h-[44px]"
        >
          {ad.ctaLabel}
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
