import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getListing } from "@/lib/listings";
import { getProfile } from "@/lib/userProfile";
import { Listing, UserProfile } from "@/lib/types";
import AuthModal from "@/components/AuthModal";
import { ArrowLeft, MessageCircle, Clock, User, Tag } from "lucide-react";
import { SiWhatsapp, SiWechat } from "react-icons/si";
import { MdGroups } from "react-icons/md";

export default function ListingDetailPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const [, params] = useRoute("/listing/:id");
  const [, navigate] = useLocation();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [contactBlocked, setContactBlocked] = useState<string | null>(null);

  // Seller profile — used for privacy toggle checks
  const [sellerProfile, setSellerProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    getListing(params.id)
      .then((l) => {
        setListing(l);
        // Fetch seller's privacy settings alongside the listing
        if (l?.userId) {
          getProfile(l.userId).then(setSellerProfile).catch(() => {});
        }
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="h-64 bg-gray-100 rounded-2xl" />
        <div className="h-4 bg-gray-100 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Listing not found.</p>
        <button onClick={() => navigate("/")} className="mt-3 text-[#003366] underline text-sm">{t.home}</button>
      </div>
    );
  }

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
  const pre = encodeURIComponent(`Hi, I saw your listing "${listing.title}" on XMUM Market. Is it still available?`);

  const handleContact = (action: () => void) => {
    if (!user) { setContactBlocked("login"); return; }
    if (!user.emailVerified) { setContactBlocked("verify"); return; }
    action();
  };

  // Privacy helpers — default to showing (true) if no profile document exists
  // so that older listings and unregistered sellers still show contact info.
  const canShowWhatsApp = listing.whatsapp && sellerProfile?.showWhatsApp !== false;
  const canShowWeChat  = listing.wechat  && sellerProfile?.showWeChat  !== false;
  const noContact = !canShowWhatsApp && !canShowWeChat && !listing.teams;

  return (
    <>
      <div className="max-w-2xl mx-auto pb-24 md:pb-8">
        {/* Back button */}
        <div className="sticky top-14 z-20 bg-white/80 backdrop-blur-sm border-b border-gray-100">
          <button onClick={() => window.history.back()} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
        </div>

        {/* Photos */}
        <div className="relative bg-black">
          {listing.photos.length > 0 ? (
            <>
              <img
                src={listing.photos[activePhoto]}
                alt={listing.title}
                className="w-full h-72 md:h-96 object-contain"
              />
              {listing.photos.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {listing.photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePhoto(i)}
                      className={`w-2 h-2 rounded-full transition-all ${i === activePhoto ? "bg-white w-4" : "bg-white/50"}`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-64 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
              <span className="text-6xl">📦</span>
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {listing.photos.length > 1 && (
          <div className="flex gap-2 px-4 py-3 bg-white border-b border-gray-100 overflow-x-auto">
            {listing.photos.map((src, i) => (
              <button
                key={i}
                onClick={() => setActivePhoto(i)}
                className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${i === activePhoto ? "border-[#003366]" : "border-transparent"}`}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="px-4 py-4 space-y-4">
          {/* Title & price */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-xl font-bold text-gray-900 leading-tight flex-1">{listing.title}</h1>
              {listing.type === "buy-sell" && (
                <span className="text-xl font-bold text-[#003366] shrink-0">
                  {listing.price === 0 ? t.free : `RM ${listing.price?.toFixed(2)}`}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                <Tag size={10} />
                {catLabel}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${listing.condition === "new" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                {listing.condition === "new" ? t.conditionNew : t.conditionUsed}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Clock size={10} />
                {timeAgo(listing.createdAt)}
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{listing.description}</p>
          </div>

          {/* Seller */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            {sellerProfile?.avatarUrl ? (
              <img
                src={sellerProfile.avatarUrl}
                alt="seller"
                className="w-9 h-9 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#003366] flex items-center justify-center text-white font-semibold text-sm">
                {listing.userEmail[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-gray-700">{t.postedBy}</p>
              <p className="text-sm font-semibold text-gray-900">
                {sellerProfile?.fullName || listing.userName}
              </p>
            </div>
          </div>

          {/* Contact blocked notice */}
          {contactBlocked && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800">
              {contactBlocked === "login" ? (
                <span>{t.loginToContact}{" "}
                  <button onClick={() => setShowAuth(true)} className="underline font-semibold">{t.signIn}</button>
                </span>
              ) : t.verifyToContact}
            </div>
          )}

          {/* Contact buttons — respect seller privacy toggles */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">{t.contactSeller}</p>
            <div className="grid grid-cols-3 gap-2">
              {canShowWhatsApp && (
                <button
                  onClick={() => handleContact(() => window.open(`https://wa.me/${listing.whatsapp?.replace(/\D/g, "")}?text=${pre}`, "_blank"))}
                  className="flex flex-col items-center gap-1.5 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 rounded-xl py-3 hover:bg-[#25D366]/20 transition-colors"
                >
                  <SiWhatsapp size={22} />
                  <span className="text-xs font-medium">{t.contactViaWhatsApp}</span>
                </button>
              )}
              {canShowWeChat && (
                <button
                  onClick={() => handleContact(() => { navigator.clipboard.writeText(listing.wechat ?? ""); alert(`WeChat ID copied: ${listing.wechat}`); })}
                  className="flex flex-col items-center gap-1.5 bg-[#09B83E]/10 text-[#09B83E] border border-[#09B83E]/20 rounded-xl py-3 hover:bg-[#09B83E]/20 transition-colors"
                >
                  <SiWechat size={22} />
                  <span className="text-xs font-medium">{t.contactViaWeChat}</span>
                </button>
              )}
              {listing.teams && (
                <button
                  onClick={() => handleContact(() => window.open(`https://teams.microsoft.com/l/chat/0/0?users=${listing.teams}&message=${pre}`, "_blank"))}
                  className="flex flex-col items-center gap-1.5 bg-[#6264A7]/10 text-[#6264A7] border border-[#6264A7]/20 rounded-xl py-3 hover:bg-[#6264A7]/20 transition-colors"
                >
                  <MdGroups size={22} />
                  <span className="text-xs font-medium">{t.contactViaTeams}</span>
                </button>
              )}
              {noContact && (
                <p className="col-span-3 text-xs text-gray-400 text-center py-2">No contact info provided.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
