import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToNotifications, markNotificationsRead } from "@/lib/notifications";
import { AppNotification } from "@/lib/types";

const NOTIF_ICONS: Record<string, string> = {
  listing_deleted: "🗑️",
  listing_sold: "✅",
  welcome: "👋",
};

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return mins <= 1 ? "Just now" : mins + "m ago";
  if (hours < 24) return hours + "h ago";
  return days + "d ago";
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;
  const hasUnread = unreadCount > 0;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub = subscribeToNotifications(user.uid, (notifs) => {
      setNotifications(prev => {
        const prevIds = new Set(prev.map(n => n.id));
        const brandNew = notifs.filter(n => !prevIds.has(n.id) && !n.read);
        brandNew.forEach(n => {
          if (Notification.permission === "granted") {
            try {
              new Notification(n.title, { body: n.body, icon: "/favicon.svg" });
            } catch {}
          }
        });
        return notifs;
      });
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const handleOpen = async () => {
    setOpen(v => !v);
    if (!open && user) {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length > 0) {
        await markNotificationsRead(user.uid, unreadIds);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length > 0) {
      await markNotificationsRead(user.uid, unreadIds);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/10 relative"
        aria-label="Notifications"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 w-[min(320px,calc(100vw-16px))] bg-white dark:bg-slate-800 rounded-2xl shadow-modal border border-gray-100 dark:border-slate-700 z-50 overflow-hidden animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notifications</p>
              {hasUnread && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline min-h-[44px] flex items-center"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-xs text-gray-400">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <span className="text-3xl mb-2">🎉</span>
                  <p className="text-sm text-slate-500 dark:text-slate-400">You're all caught up!</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-gray-50 dark:border-slate-700/50 last:border-0 flex items-start gap-3 ${!n.read ? "bg-blue-50 dark:bg-blue-950/40 font-medium" : "bg-transparent"}`}
                  >
                    <span className="text-base shrink-0 mt-0.5">{NOTIF_ICONS[n.type] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs text-gray-800 dark:text-slate-100 ${!n.read ? "font-semibold" : "font-normal text-slate-500 dark:text-slate-400"}`}>{n.title}</p>
                      <p className={`text-xs mt-0.5 ${!n.read ? "text-gray-600 dark:text-slate-300" : "text-gray-400 dark:text-slate-500"}`}>{n.body}</p>
                      <p className="text-[10px] text-gray-300 dark:text-slate-600 mt-1">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
