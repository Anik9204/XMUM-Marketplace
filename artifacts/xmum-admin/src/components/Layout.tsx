import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Flag, Users, Megaphone, FileText, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

const NAV = [
  { href: "/",             label: "Dashboard",    icon: LayoutDashboard },
  { href: "/reports",      label: "Reports",      icon: Flag },
  { href: "/users",        label: "Users",        icon: Users },
  { href: "/ads",          label: "Ads",          icon: Megaphone },
  { href: "/rental-audit", label: "Rental Audit", icon: FileText },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { adminUser } = useAuth();

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
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link key={href} href={href}>
                <a className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                  active
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                }`}>
                  <Icon className="w-4 h-4" />
                  {label}
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
