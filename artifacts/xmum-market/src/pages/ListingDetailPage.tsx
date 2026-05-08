import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getListing, markAsSold } from "@/lib/listings";
import { getProfile } from "@/lib/userProfile";
import { Listing, UserProfile } from "@/lib/types";
import AuthModal from "@/components/AuthModal";
import { ArrowLeft, Clock, Tag, CheckCircle2, MapPin, MessageCircle, Loader2 } from "lucide-react";
import { getOrCreateConversation } from "@/lib/messaging";
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
  const [markingAsSold, setMarkingAsSold] = useState(false);
  const [soldToast, setSoldToast] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

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
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

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
      navigate(`/messages?conv=${convId}`);
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

  const canShowWhatsApp = listing.whatsapp && sellerProfile?.showWhatsApp !== false;
  const canShowWeChat  = listing.wechat  && sellerProfile?.showWeChat  !== false;
  const noContact = !canShowWhatsApp && !canShowWeChat && !listing.teams;

  return (
    <>
      {/* Sold toast */}
      {soldToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#003366] dark:bg-blue-700 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl">
          <CheckCircle2 size={18} className="text-green-300 shrink-0" />
          {t.markedAsSold}
        </div>
      )}

      <div className="max-w-2xl mx-auto pb-24 md:pb-8 animate-in fade-in duration-200">
        {/* Back button */}
        <div className="sticky top-14 sm:top-16 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-gray-100 dark:border-slate-700">
          <button onClick={() => window.history.back()} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white min-h-[44px]">
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
                className={`w-full h-64 sm:h-80 md:h-96 object-contain ${isSold ? "opacity-50" : ""}`}
              />
              {isSold && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-black/75 text-white text-2xl font-black tracking-widest px-6 py-3 rounded-2xl rotate-[-8deg] shadow-2xl">
                    {listing.type === "lost-found" ? t.resolvedBadge : t.soldBadge}
                  </span>
                </div>
              )}
              {listing.photos.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {listing.photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePhoto(i)}
                      className={`h-2 rounded-full transition-all ${i === activePhoto ? "bg-white w-4" : "bg-white/50 w-2"}`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className={`w-full h-64 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center ${isSold ? "opacity-50" : ""}`}>
              <span className="text-6xl">📦</span>
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

        {/* Thumbnails */}
        {listing.photos.length > 1 && (
          <div className="flex gap-2 px-4 py-3 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700 overflow-x-auto">
            {listing.photos.map((src, i) => (
              <button
                key={i}
                onClick={() => setActivePhoto(i)}
                className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${i === activePhoto ? "border-[#003366] dark:border-blue-400" : "border-transparent"}`}
              >
                <img src={src} alt={`${listing.title} photo ${i + 1}`} className="w-full h-full object-cover" />
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
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-tight flex-1">{listing.title}</h1>
              {listing.type === "buy-sell" && (
                <span className={`text-xl font-bold shrink-0 ${isSold ? "text-gray-400 dark:text-slate-500 line-through" : "text-[#003366] dark:text-blue-400"}`}>
                  {listing.price === 0 ? t.free : `RM ${listing.price?.toFixed(2)}`}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 px-2 py-1 rounded-full">
                <Tag size={10} />{catLabel}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${listing.condition === "new" ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                {listing.condition === "new" ? t.conditionNew : t.conditionUsed}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
                <Clock size={10} />{timeAgo(listing.createdAt)}
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{listing.description}</p>
          </div>

          {/* Seller */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
            {sellerProfile?.avatarUrl ? (
              <img src={sellerProfile.avatarUrl} alt="seller" className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-slate-600" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#003366] flex items-center justify-center text-white font-semibold text-sm">
                {listing.userEmail[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{t.postedBy}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{sellerProfile?.fullName || listing.userName}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{listing.userEmail}</p>
            </div>
          </div>

          {/* Owner: Mark as Sold */}
          {isOwner && !isSold && (
            <button
              onClick={handleMarkAsSold}
              disabled={markingAsSold}
              className="w-full min-h-[44px] border-2 border-[#003366] dark:border-blue-500 text-[#003366] dark:text-blue-400 rounded-xl py-2.5 text-sm font-semibold hover:bg-[#003366]/5 dark:hover:bg-blue-500/10 disabled:opacity-50 transition-colors"
            >
              {markingAsSold ? "Updating..." : (listing.type === "lost-found" ? t.markAsResolved : t.markAsSold)}
            </button>
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

          {/* Contact buttons — hidden when sold; skeleton while seller profile loads */}
          {!isSold && (
            <div>
              {/* Message Seller — first contact option, only for logged-in verified non-owners */}
              {user && user.emailVerified && user.uid !== listing.userId && (
                <button
                  onClick={handleMessageSeller}
                  disabled={startingChat}
                  className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-[#003366] dark:bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-[#002244] dark:hover:bg-blue-700 disabled:opacity-50 transition-colors mb-3"
                >
                  {startingChat ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                  {t.messageSeller}
                </button>
              )}
              {chatError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 mb-2">
                  {chatError}
                </p>
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
                      onClick={() => handleContact(() => window.open(`https://wa.me/${listing.whatsapp?.replace(/\D/g, "")}?text=${pre}`, "_blank"))}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto flex-1 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 rounded-xl py-3 min-h-[44px] hover:bg-[#25D366]/20 transition-colors"
                    >
                      <SiWhatsapp size={20} />
                      <span className="text-sm font-medium">{t.contactViaWhatsApp}</span>
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
                  {listing.teams && (
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

          {listing.meetupSpot && (
            <div className="flex items-start gap-2 mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
              <MapPin size={15} className="text-[#003366] dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-[#003366] dark:text-blue-400">{t.meetupSpot}</p>
                <p className="text-sm text-gray-700 dark:text-slate-200 mt-0.5">{listing.meetupSpot}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
