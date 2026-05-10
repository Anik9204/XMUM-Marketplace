import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Flag, Users, Megaphone, FileText, LogOut, GraduationCap } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { adminUser } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "users"), where("verificationStatus", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => setPendingCount(snap.size), () => {});
    return unsub;
  }, []);

  const NAV = [
    { href: "/",             label: "Dashboard",    icon: LayoutDashboard, badge: 0 },
    { href: "/reports",      label: "Reports",      icon: Flag,            badge: 0 },
    { href: "/users",        label: "Users",        icon: Users,           badge: 0 },
    { href: "/ads",          label: "Ads",          icon: Megaphone,       badge: 0 },
    { href: "/rental-audit", label: "Rental Audit", icon: FileText,        badge: 0 },
    { href: "/verifications",label: "Verifications",icon: GraduationCap,   badge: pendingCount },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <aside className="w-60 flex-shrink-0 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">X</div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">XMUM Admin</p>
              <p className="text-[10px] text-slate-400 capitalize">{adminUser?.role}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon, badge }) => {
            const active = location === href;
            return (
              <Link key={href} href={href}>
                <a className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                  active
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                }`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {badge > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                      {badge}
                    </span>
                  )}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100 dark:border-slate-700">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{adminUser?.displayName}</p>
            <p className="text-[10px] text-slate-400 truncate">{adminUser?.email}</p>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
