import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Flag, Users, Megaphone, FileText,
  List, BarChart2, LogOut,
  Store, Newspaper, Moon, Sun, Menu, X, ShieldAlert, ClipboardList, SlidersHorizontal,
  Bell,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useDarkMode } from "../contexts/DarkModeContext";
import {
  collection, query, where, onSnapshot, orderBy, limit,
  updateDoc, doc, writeBatch,
} from "firebase/firestore";

interface AdminNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  shopId?: string;
  shopName?: string;
  createdAt: { seconds: number } | null;
  isRead: boolean;
}

function timeAgo(n: AdminNotification): string {
  if (!n.createdAt) return "";
  const diff = Date.now() - n.createdAt.seconds * 1000;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { adminUser, isAdmin } = useAuth();
  const [pendingReports, setPendingReports]               = useState(0);
  const [pendingShopApprovals, setPendingShopApprovals]   = useState(0);
  const { dark, toggle } = useDarkMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Notification bell state
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [bellOpen, setBellOpen]           = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, "reports"), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => setPendingReports(snap.size), () => {});
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "shops"),
      where("approvalStatus", "==", "pending")
    );
    const unsub = onSnapshot(
      q,
      (snap) => setPendingShopApprovals(snap.size),
      () => {}
    );
    return unsub;
  }, []);

  // Real-time notifications listener for the current admin user
  useEffect(() => {
    if (!adminUser?.uid) return;
    const q = query(
      collection(db, "users", adminUser.uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(20),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(
          snap.docs.map((d) => ({
            id: d.id,
            title:     d.data().title    ?? "",
            body:      d.data().body     ?? "",
            type:      d.data().type     ?? "",
            shopId:    d.data().shopId,
            shopName:  d.data().shopName,
            createdAt: d.data().createdAt ?? null,
            isRead:    d.data().isRead    ?? d.data().read ?? false,
          }))
        );
      },
      () => {},
    );
    return unsub;
  }, [adminUser?.uid]);

  // Close bell dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markAllRead() {
    if (!adminUser?.uid) return;
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    for (const n of unread) {
      batch.update(doc(db, "users", adminUser.uid, "notifications", n.id), { isRead: true });
    }
    await batch.commit().catch(() => {});
  }

  async function markRead(n: AdminNotification) {
    if (!adminUser?.uid || n.isRead) return;
    await updateDoc(
      doc(db, "users", adminUser.uid, "notifications", n.id),
      { isRead: true }
    ).catch(() => {});
  }

  const NAV = [
    { href: "/",              label: "Dashboard",     icon: LayoutDashboard },
    { href: "/listings",      label: "Listings",      icon: List },
    { href: "/users",         label: "Users",         icon: Users },
    { href: "/reports",       label: "Reports",       icon: Flag },
    { href: "/rental-audit",  label: "Rental Audit",  icon: FileText },
    { href: "/ads",           label: "Ads",           icon: Megaphone },
    { href: "/analytics",     label: "Analytics",     icon: BarChart2 },
    { href: "/shops",         label: "Shops",         icon: Store },
    { href: "/shop-approvals", label: "Shop Approvals", icon: ClipboardList },
    { href: "/shop-ads",      label: "Shop Ads",      icon: Newspaper },
    { href: "/audit-log",          label: "Audit Log",        icon: ShieldAlert },
    { href: "/subscription-config", label: "Subscription Config", icon: SlidersHorizontal },
  ];

  // Notification bell button — reused in both mobile bar and sidebar
  const NotificationBell = () => (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => setBellOpen((v) => !v)}
        className="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400
                   dark:hover:text-slate-200 rounded-lg transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold
                           rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {bellOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-white dark:bg-slate-800
                        border border-gray-100 dark:border-slate-700 rounded-2xl shadow-2xl
                        overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b
                          border-gray-100 dark:border-slate-700">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-slate-700/50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n)}
                  className={`w-full text-left px-4 py-3 transition-colors hover:bg-slate-50
                              dark:hover:bg-slate-700/40
                              ${!n.isRead ? "bg-blue-50/60 dark:bg-blue-950/30" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug
                                  ${!n.isRead ? "text-blue-900 dark:text-blue-200" : ""}`}>
                      {n.title}
                    </p>
                    {!n.isRead && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 text-left">
                    {n.body}
                  </p>
                  {n.createdAt && (
                    <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n)}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-30 w-60 flex-shrink-0
        bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700
        flex flex-col transition-transform duration-200
        lg:static lg:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">X</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">XMUM Admin</p>
              <p className="text-[10px] text-slate-400 capitalize">{adminUser?.role}</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700
                         dark:hover:text-slate-200 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            if (label === "Audit Log" && !isAdmin) return null;
            const active = location === href;
            return (
              <Link key={href} href={href} onClick={() => setSidebarOpen(false)}>
                <a className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                  active
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                }`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{label}</span>

                  {label === "Reports" && pendingReports > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[9px] font-bold
                                     rounded-full min-w-[18px] h-[18px] flex items-center
                                     justify-center px-1">
                      {pendingReports > 99 ? "99+" : pendingReports}
                    </span>
                  )}
                  {label === "Shop Approvals" && pendingShopApprovals > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[9px] font-bold
                                     rounded-full min-w-[18px] h-[18px] flex items-center
                                     justify-center px-1">
                      {pendingShopApprovals > 99 ? "99+" : pendingShopApprovals}
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
            onClick={toggle}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                       text-slate-600 dark:text-slate-400 hover:bg-slate-50
                       dark:hover:bg-slate-700/50 transition-colors min-h-[44px] mb-1"
          >
            {dark
              ? <Sun className="w-4 h-4 text-amber-400" />
              : <Moon className="w-4 h-4" />}
            {dark ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* Top bar — mobile hamburger + notification bell */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white
                        dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700
                        flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200
                       rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 lg:hidden">
            XMUM Admin
          </p>
          <div className="flex-1" />
          <NotificationBell />
        </div>

        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
