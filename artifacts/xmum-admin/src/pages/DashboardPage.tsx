import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Users, Flag, Megaphone, ShoppingBag, TrendingUp } from "lucide-react";

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

  useEffect(() => {
    async function load() {
      try {
        const [usersSnap, listingsSnap, reportsSnap, adsSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(query(collection(db, "listings"), where("isArchived", "==", false))),
          getDocs(query(collection(db, "reports"), where("status", "==", "pending"))),
          getDocs(query(collection(db, "ads"), where("isActive", "==", true))),
        ]);
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recentSignups = usersSnap.docs.filter(
          d => (d.data().createdAt ?? 0) > sevenDaysAgo
        ).length;
        setStats({
          totalUsers:     usersSnap.size,
          totalListings:  listingsSnap.size,
          pendingReports: reportsSnap.size,
          activeAds:      adsSnap.size,
          recentSignups,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Platform overview</p>
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
          <StatCard icon={Flag}        label="Pending Reports" value={stats.pendingReports} color="bg-red-500" />
          <StatCard icon={Megaphone}   label="Active Ads"      value={stats.activeAds}      color="bg-amber-500" />
          <StatCard icon={TrendingUp}  label="New Users (7d)"  value={stats.recentSignups}  color="bg-purple-500" />
        </div>
      ) : null}
    </div>
  );
}
