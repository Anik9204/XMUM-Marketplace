import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Users, Flag, Megaphone, ShoppingBag, TrendingUp, RefreshCw } from "lucide-react";

interface Stats {
  totalUsers: number;
  totalListings: number;
  pendingReports: number;
  activeAds: number;
  recentSignups: number;
}

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
  const [refreshing, setRefreshing] = useState(false);
  const [pendingReports, setPendingReports] = useState(0);

  const loadStatic = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [usersSnap, listingsSnap, adsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(query(collection(db, "listings"), where("isArchived", "==", false))),
        getDocs(query(collection(db, "ads"), where("isActive", "==", true))),
      ]);
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentSignups = usersSnap.docs.filter(
        d => (d.data().createdAt ?? 0) > sevenDaysAgo
      ).length;
      setStats(prev => ({
        totalUsers:     usersSnap.size,
        totalListings:  listingsSnap.size,
        pendingReports: prev?.pendingReports ?? 0,
        activeAds:      adsSnap.size,
        recentSignups,
      }));
    } catch (e) {
      console.error("[DashboardPage] load failed:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStatic();

    const q = query(collection(db, "reports"), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => {
      const count = snap.size;
      setPendingReports(count);
      setStats(prev => prev ? { ...prev, pendingReports: count } : null);
    }, (err) => {
      console.error("[DashboardPage] reports onSnapshot error:", err);
    });

    return () => unsub();
  }, [loadStatic]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Platform overview</p>
        </div>
        <button
          onClick={() => loadStatic(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400
                     hover:text-slate-700 dark:hover:text-slate-200 border border-gray-200
                     dark:border-slate-700 rounded-xl px-3 py-2 min-h-[40px]
                     disabled:opacity-50 transition-colors bg-white dark:bg-slate-800">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
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
