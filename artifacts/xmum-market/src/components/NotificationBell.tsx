import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getNotifications, markNotificationsRead } from "@/lib/notifications";
import { AppNotification } from "@/lib/types";

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getNotifications(user.uid)
      .then(setNotifications)
      .finally(() => setLoading(false));
  }, [user]);

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
          <div className="absolute right-0 top-11 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
              <p className="text-sm font-bold text-gray-800 dark:text-slate-100">Notifications</p>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-xs text-gray-400">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 dark:text-slate-500">
                  No notifications yet
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-gray-50 dark:border-slate-700/50 last:border-0 ${!n.read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}
                  >
                    <p className="text-xs font-semibold text-gray-800 dark:text-slate-100">{n.title}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{n.body}</p>
                    <p className="text-[10px] text-gray-300 dark:text-slate-600 mt-1">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </p>
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
