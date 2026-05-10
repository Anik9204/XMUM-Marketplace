import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Users, Flag, Megaphone, ShoppingBag, TrendingUp } from "lucide-react";

interface Stats {
  totalUsers: number;
  totalListings: number;
  pendingReports: number;
  activeAds: number;
  recentSignups: number;
}

const defaultStats: Stats = {
  totalUsers: 0,
  totalListings: 0,
  pendingReports: 0,
  activeAds: 0,
  recentSignups: 0,
};

function StatCard({ icon: Icon, label, value, color }:
  { icon: any; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border
                    border-gray-100 dark:border-slate-700">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center
                       justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingReports, setPendingReports] = useState(0);

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
        const count = snap.size;
        setPendingReports(count);
        setStats(p => ({ ...(p ?? defaultStats), pendingReports: count }));
        setLoading(false);
      },
      err => {
        console.error("[Dashboard] reports snapshot:", err);
        setLoading(false);
      }
    ));

    return () => unsubs.forEach(u => u());
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-5 h-28
                                    animate-pulse border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users}       label="Total Users"     value={stats.totalUsers}     color="bg-blue-500" />
          <StatCard icon={ShoppingBag} label="Active Listings" value={stats.totalListings}  color="bg-green-500" />
          <StatCard icon={Flag}        label="Pending Reports" value={pendingReports}        color="bg-red-500" />
          <StatCard icon={Megaphone}   label="Active Ads"      value={stats.activeAds}      color="bg-amber-500" />
          <StatCard icon={TrendingUp}  label="New Users (7d)"  value={stats.recentSignups}  color="bg-purple-500" />
        </div>
      ) : null}
    </div>
  );
}
