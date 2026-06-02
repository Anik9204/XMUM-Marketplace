import { Link, useLocation } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { logOut } from "@/lib/auth";
import AuthModal from "@/components/AuthModal";
import VerificationBanner from "@/components/VerificationBanner";
import { Home, Search, User, Globe, MessageCircle, Plus, Store, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { useDarkMode } from "@/hooks/use-dark-mode";
import NotificationBell from "@/components/NotificationBell";
import { subscribeToUnreadCount } from "@/lib/messaging";
import { getPendingActivityCount } from "@/lib/shops";
import { getProfile } from "@/lib/userProfile";


export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, toggleLang, lang } = useLang();
  const { user } = useAuth();
  const { dark, toggle: toggleDark } = useDarkMode();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("signin") === "1") {
      setShowAuth(true);
    }
  }, []);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [shopPendingCount, setShopPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [postTabHint, setPostTabHint] = useState("");

  function getPostHref(): string {
    const validPostTabs = ["buy-sell", "lost-found", "jobs", "assistance", "rental"];
    if (postTabHint && validPostTabs.includes(postTabHint) && postTabHint !== "buy-sell") return `/post?type=${postTabHint}`;
    return "/post";
  }

  useEffect(() => {
    const handler = (e: Event) => setPostTabHint((e as CustomEvent<string>).detail);
    window.addEventListener("xmum_home_tab", handler);
    return () => window.removeEventListener("xmum_home_tab", handler);
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      setShowBackOnline(true);
      setTimeout(() => setShowBackOnline(false), 3000);
    };
    const onOffline = () => {
      setIsOnline(false);
      setShowBackOnline(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);


  useEffect(() => {
    if (!user) { setUnreadMessages(0); return; }
    const unsub = subscribeToUnreadCount(user.uid, setUnreadMessages);
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user) { setShopPendingCount(0); return; }
    let interval: ReturnType<typeof setInterval> | undefined;
    getProfile(user.uid).then((profile) => {
      const shopId = profile?.myShopIds?.[0];
      if (!shopId) return;
      getPendingActivityCount(shopId).then(setShopPendingCount).catch(() => {});
      interval = setInterval(() => {
        getPendingActivityCount(shopId).then(setShopPendingCount).catch(() => {});
      }, 60000);
    }).catch(() => {});
    return () => { if (interval) clearInterval(interval); };
  }, [user?.uid]);

  const navItems = [
    { href: "/", icon: Home, label: t.home },
    { href: "/search", icon: Search, label: t.search },
    { href: "/campus-market", icon: Store, label: t.campusMarket },
    { href: "/messages", icon: MessageCircle, label: t.messages },
    { href: "/profile", icon: User, label: t.profile, activeFor: ["/profile", "/settings"] },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] flex flex-col">
      {!isOnline && (
        <div className="sticky top-0 z-[60] bg-amber-500 text-white text-xs font-semibold text-center py-2 px-4 flex items-center justify-center gap-2">
          📡 You're offline. Some features may not work.
        </div>
      )}
      {showBackOnline && (
        <div className="sticky top-0 z-[60] bg-emerald-500 text-white text-xs font-semibold text-center py-2 px-4 flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
          ✅ You're back online!
        </div>
      )}
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header data-sticky className="sticky top-0 z-50 bg-[#003366] dark:bg-slate-900 shadow-[0_2px_8px_rgb(0,51,102,0.35)] border-b border-slate-200 dark:border-slate-700/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0" aria-label="XMUM Market Home">
            <img
              src="/xmum-market-logo.png"
              alt="XMUM Market"
              className="h-10 sm:h-12 w-auto object-contain"
            />
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDark}
              title="Toggle dark mode"
              className="flex items-center justify-center text-white/80 hover:text-white transition-colors p-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-white/10"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Language Toggle */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1 text-white/80 hover:text-white text-sm font-medium transition-colors p-2 min-h-[44px] min-w-[44px] justify-center rounded-lg hover:bg-white/10 font-display"
            >
              <Globe size={16} />
              <span className="hidden sm:inline">{lang === "en" ? "中文" : "EN"}</span>
            </button>

            {/* Notification bell — signed-in users only */}
            {user && <NotificationBell />}

            {/* Desktop nav — md and above */}
            <nav className="hidden md:flex items-center gap-1">
              <Link href="/" className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${location === "/" ? "text-white bg-white/20" : "text-white/70 hover:text-white hover:bg-white/10"}`}>{t.home}</Link>
              <Link href="/search" className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${location === "/search" ? "text-white bg-white/20" : "text-white/70 hover:text-white hover:bg-white/10"}`}>{t.search}</Link>
              <Link href="/messages" className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${location === "/messages" ? "text-white bg-white/20" : "text-white/70 hover:text-white hover:bg-white/10"}`}>
                {t.messages}
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Link>
              <Link href="/campus-market" className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${location === "/campus-market" ? "text-white bg-white/20" : "text-white/70 hover:text-white hover:bg-white/10"}`}>
                {t.campusMarket}
                {shopPendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                    {shopPendingCount > 9 ? "9+" : shopPendingCount}
                  </span>
                )}
              </Link>
              <Link href={getPostHref()} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${location === "/post" ? "text-white bg-white/20" : "text-white/70 hover:text-white hover:bg-white/10"}`}>{t.post}</Link>
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {t.profile}
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-10 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 min-w-[180px] z-[70] overflow-hidden">
                        <Link href="/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-t-xl">{t.myListings}</Link>
                        <Link href="/settings" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 border-t border-gray-100 dark:border-slate-700">{t.accountSettings}</Link>
                        <Link href="/help" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 border-t border-gray-100 dark:border-slate-700">How to use the app</Link>
                        <button onClick={() => { logOut(); setMenuOpen(false); }} className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl border-t border-gray-100 dark:border-slate-700">{t.signOut}</button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="ml-1 px-4 py-1.5 min-h-[36px] bg-white text-[#003366] rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
                >
                  {t.signIn}
                </button>
              )}
            </nav>

            {/* Mobile: sign-in button when not logged in */}
            {!user && (
              <button
                onClick={() => setShowAuth(true)}
                className="md:hidden px-3 py-1.5 min-h-[44px] bg-white text-[#003366] rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
              >
                {t.signIn}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Verification banner */}
      {user && !user.emailVerified ? (
        <div ref={(el) => {
          document.documentElement.style.setProperty(
            '--verif-banner-h',
            el ? `${el.offsetHeight}px` : '0px'
          );
        }}>
          <VerificationBanner />
        </div>
      ) : null}

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      {/* Footer — desktop only */}
      <footer className={`hidden md:block bg-[#003366] dark:bg-slate-900 dark:border-t dark:border-slate-700 text-white/70 text-xs px-4 ${location === "/" ? "py-6" : "py-3"}`}>
        <div className="max-w-5xl mx-auto">
          {location === "/" && (
            <>
              <p className="font-display font-semibold text-white/90 mb-1">{t.pdpaTitle}</p>
              <p className="mb-3">{t.pdpaText}</p>
            </>
          )}
          <p className="text-white/50">{t.allRights}</p>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-100 dark:border-slate-700/80">
        <div className="flex pb-[env(safe-area-inset-bottom)]">
          {navItems.map(({ href, icon: Icon, label, activeFor }) => {
            const active = activeFor ? activeFor.includes(location) : location === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center min-h-[60px] gap-1 transition-all duration-200 ${active ? "text-[#003366] dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}
              >
                <div className={`relative px-3 py-1 rounded-xl ${active ? "bg-[#003366]/10 dark:bg-blue-500/20" : ""}`}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 1.6} />
                  {href === "/messages" && unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5 leading-none">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                  {href === "/campus-market" && shopPendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                      {shopPendingCount > 9 ? "9+" : shopPendingCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold font-display leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button — Home and Search only, authenticated, mobile only */}
      {user && (location === "/" || location === "/search") && (
        <Link href={getPostHref()}>
          <button className="fixed bottom-[76px] right-4 z-[45] w-14 h-14 bg-[#003366] dark:bg-blue-600 text-white rounded-2xl shadow-[0_4px_20px_rgb(0,51,102,0.4)] dark:shadow-[0_4px_20px_rgb(37,99,235,0.4)] flex items-center justify-center transition-all duration-200 hover:scale-110 hover:brightness-110 active:scale-95 md:hidden">
            <Plus className="w-6 h-6" />
          </button>
        </Link>
      )}

      {/* Auth modal — global, triggered from header */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
