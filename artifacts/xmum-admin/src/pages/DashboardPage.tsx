import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { Link } from "wouter";
import { db } from "../lib/firebase";
import {
  Users, Flag, Megaphone, ShoppingBag, TrendingUp,
  Store, Newspaper, Activity, AlertTriangle, ClipboardList,
} from "lucide-react";

interface Stats {
  totalUsers: number;
  totalListings: number;
  pendingReports: number;
  activeAds: number;
  recentSignups: number;
  pendingShopAds: number;
  totalShops: number;
  suspendedShops: number;
  pendingShopApprovals: number;
}

const defaultStats: Stats = {
  totalUsers: 0, totalListings: 0, pendingReports: 0,
  activeAds: 0, recentSignups: 0,
  pendingShopAds: 0, totalShops: 0, suspendedShops: 0, pendingShopApprovals: 0,
};

interface ActivityItem {
  id: string;
  type: string;
  label: string;
  sub: string;
  time: number;
  href: string;
}

function StatCard({ icon: Icon, label, value, color, href }: {
  icon: any; label: string; value: number | string; color: string; href?: string;
}) {
  const inner = (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border
                    border-gray-100 dark:border-slate-700 hover:border-blue-200
                    dark:hover:border-blue-700 transition-colors cursor-pointer">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center
                       justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(
      collection(db, "users"),
      (snap) => {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recentSignups = snap.docs.filter(
          d => (d.data().createdAt ?? 0) > sevenDaysAgo
        ).length;
        setStats(p => ({
          ...(p ?? defaultStats),
          totalUsers: snap.size,
          recentSignups,
        }));
      },
      err => console.error("[Dashboard] users snapshot:", err)
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "listings"), where("isArchived", "==", false)),
      (snap) => setStats(p => ({ ...(p ?? defaultStats), totalListings: snap.size })),
      err => console.error("[Dashboard] listings snapshot:", err)
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "ads"), where("isActive", "==", true)),
      (snap) => setStats(p => ({ ...(p ?? defaultStats), activeAds: snap.size })),
      err => console.error("[Dashboard] ads snapshot:", err)
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "reports"), where("status", "==", "pending")),
      (snap) => {
        setStats(p => ({ ...(p ?? defaultStats), pendingReports: snap.size }));
        setLoading(false);
      },
      err => {
        console.error("[Dashboard] reports snapshot:", err);
        setLoading(false);
      }
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "shopAds"), where("status", "==", "pending")),
      (snap) => setStats(p => ({ ...(p ?? defaultStats), pendingShopAds: snap.size })),
      err => console.error("[Dashboard] shopAds snapshot:", err)
    ));

    unsubs.push(onSnapshot(
      collection(db, "shops"),
      (snap) => setStats(p => ({ ...(p ?? defaultStats), totalShops: snap.size })),
      err => console.error("[Dashboard] shops snapshot:", err)
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "shops"), where("isSuspended", "==", true)),
      (snap) => setStats(p => ({ ...(p ?? defaultStats), suspendedShops: snap.size })),
      err => console.error("[Dashboard] suspendedShops snapshot:", err)
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "shops"), where("approvalStatus", "==", "pending")),
      (snap) => setStats(p => ({ ...(p ?? defaultStats), pendingShopApprovals: snap.size })),
      err => console.error("[Dashboard] pendingShopApprovals snapshot:", err)
    ));

    return () => unsubs.forEach(u => u());
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "platformActivityFeed"),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: ActivityItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: data.type ?? "event",
            label: data.label ?? "Platform event",
            sub: data.sub ?? "",
            time: data.createdAt ?? 0,
            href: data.href ?? "/",
          };
        });
        setActivity(items);
        setActivityLoading(false);
      },
      (err) => {
        console.error("[Dashboard] activity feed snapshot:", err);
        setActivityLoading(false);
      }
    );
    return unsub;
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center">
            Dashboard
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold
                             text-green-600 dark:text-green-400 bg-green-50
                             dark:bg-green-900/30 px-2 py-0.5 rounded-full ml-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
              Live
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Platform overview</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-5 h-28
                                    animate-pulse border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users}         label="Total Users"           value={stats.totalUsers}           color="bg-blue-500"   href="/users" />
          <StatCard icon={ShoppingBag}   label="Active Listings"       value={stats.totalListings}        color="bg-green-500"  href="/listings" />
          <StatCard icon={Flag}          label="Pending Reports"       value={stats.pendingReports}       color="bg-red-500"    href="/reports" />
          <StatCard icon={Newspaper}     label="Pending Shop Ads"      value={stats.pendingShopAds}       color="bg-amber-500"  href="/shop-ads" />
          <StatCard icon={Store}         label="Total Shops"           value={stats.totalShops}           color="bg-teal-500"   href="/shops" />
          <StatCard icon={AlertTriangle} label="Suspended Shops"        value={stats.suspendedShops}       color="bg-orange-500" href="/shops" />
          <StatCard icon={ClipboardList} label="Pending Shop Approvals" value={stats.pendingShopApprovals} color="bg-amber-600"  href="/shop-approvals" />
          <StatCard icon={Megaphone}     label="Active Platform Ads"   value={stats.activeAds}            color="bg-purple-500" href="/ads" />
          <StatCard icon={TrendingUp}    label="New Users (7d)"        value={stats.recentSignups}        color="bg-pink-500" />
        </div>
      ) : null}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100
                      dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700
                        flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Recent Activity
          </h2>
        </div>
        {activityLoading ? (
          <div className="space-y-px">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-50 dark:bg-slate-800/50 animate-pulse mx-4 my-2 rounded-xl" />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">No recent activity.</p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {activity.map((item) => (
              <Link key={item.id + item.time} href={item.href}>
                <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50
                                dark:hover:bg-slate-700/30 transition-colors cursor-pointer">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    item.type === "report"            ? "bg-red-400"    :
                    item.type === "signup"            ? "bg-green-400"  :
                    item.type === "rental_posted"     ? "bg-amber-400"  :
                    item.type === "listing_posted"    ? "bg-blue-400"   :
                    item.type === "listing_deleted"   ? "bg-slate-400"  :
                    item.type === "shop_ad"           ? "bg-purple-400" :
                    item.type === "shop_approved"     ? "bg-teal-400"   :
                    item.type === "shop_rejected"     ? "bg-rose-400"   :
                    item.type === "user_banned"       ? "bg-red-600"    :
                    item.type === "moderation"        ? "bg-orange-400" :
                                                        "bg-slate-300"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{item.sub}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 flex-shrink-0">
                    {new Date(item.time).toLocaleDateString("en-MY", {
                      day: "numeric", month: "short",
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
