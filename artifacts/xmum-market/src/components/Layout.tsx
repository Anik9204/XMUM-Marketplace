import { Link, useLocation } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { logOut } from "@/lib/auth";
import AuthModal from "@/components/AuthModal";
import VerificationBanner from "@/components/VerificationBanner";
import { Home, Search, PlusSquare, User, Globe, MessageCircle } from "lucide-react";
import { useState } from "react";
import NotificationBell from "@/components/NotificationBell";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, toggleLang, lang } = useLang();
  const { user } = useAuth();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const navItems = [
    { href: "/", icon: Home, label: t.home },
    { href: "/search", icon: Search, label: t.search },
    { href: "/messages", icon: MessageCircle, label: t.messages },
    { href: "/post", icon: PlusSquare, label: t.post },
    { href: "/profile", icon: User, label: t.profile, activeFor: ["/profile", "/settings"] },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#003366] dark:bg-slate-900 shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-white font-bold text-lg tracking-tight">
              {t.appName}
            </span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Language Toggle — icon only on xs, text on sm+ */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1 text-white/80 hover:text-white text-sm font-medium transition-colors p-2 min-h-[44px] min-w-[44px] justify-center rounded-lg hover:bg-white/10"
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
              <Link href="/messages" className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${location === "/messages" ? "text-white bg-white/20" : "text-white/70 hover:text-white hover:bg-white/10"}`}>{t.messages}</Link>
              <Link href="/post" className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${location === "/post" ? "text-white bg-white/20" : "text-white/70 hover:text-white hover:bg-white/10"}`}>{t.post}</Link>
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
                      <div className="absolute right-0 top-9 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 min-w-44 z-[70]">
                        <Link href="/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-t-xl">{t.myListings}</Link>
                        <Link href="/settings" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 border-t border-gray-100 dark:border-slate-700">{t.accountSettings}</Link>
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
      {user && !user.emailVerified && <VerificationBanner />}

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      {/* Footer — desktop only */}
      <footer className="hidden md:block bg-[#003366] dark:bg-slate-900 dark:border-t dark:border-slate-700 text-white/70 text-xs py-6 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="font-semibold text-white/90 mb-1">{t.pdpaTitle}</p>
          <p className="mb-3">{t.pdpaText}</p>
          <p className="text-white/50">{t.allRights}</p>
        </div>
      </footer>

      {/* Mobile bottom nav — min 48px tap targets, safe area inset */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 z-40">
        <div className="flex pb-[env(safe-area-inset-bottom)]">
          {navItems.map(({ href, icon: Icon, label, activeFor }) => {
            const active = activeFor ? activeFor.includes(location) : location === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center h-12 gap-0.5 transition-colors ${active ? "text-[#003366] dark:text-blue-400" : "text-gray-400 dark:text-slate-500"}`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[9px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="bg-gray-50 dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 px-4 py-2">
          <p className="text-[9px] text-gray-400 dark:text-slate-500 text-center leading-relaxed">
            {t.pdpaText}
          </p>
        </div>
      </nav>

      {/* Auth modal — global, triggered from header */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
