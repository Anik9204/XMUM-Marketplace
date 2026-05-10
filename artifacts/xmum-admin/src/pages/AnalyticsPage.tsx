import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  ResponsiveContainer,
} from "recharts";
import { Users, List, Flag, Star, Loader2 } from "lucide-react";

interface DayEntry  { date: string; count: number }
interface ViewEntry { date: string; views: number }
interface TypeEntry { name: string; value: number }

interface Stats {
  totalUsers: number;
  totalListings: number;
  pendingReports: number;
  totalReviews: number;
}

const TYPE_COLORS: Record<string, string> = {
  "buy-sell":   "#003366",
  "lost-found": "#0D9488",
  "jobs":       "#7C3AED",
  "assistance": "#EA580C",
  "rental":     "#D97706",
};

const TYPE_LABELS: Record<string, string> = {
  "buy-sell":   "Buy & Sell",
  "lost-found": "Lost & Found",
  "jobs":       "Jobs",
  "assistance": "Assistance",
  "rental":     "Rental",
};

function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number; color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function dateKey(ms: number): string {
  return new Date(ms).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

function buildDayRange(): string[] {
  const keys: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    keys.push(d.toLocaleDateString("en-MY", { day: "numeric", month: "short" }));
  }
  return keys;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [listingsPerDay, setListingsPerDay] = useState<DayEntry[]>([]);
  const [typeDistribution, setTypeDistribution] = useState<TypeEntry[]>([]);
  const [viewsPerDay, setViewsPerDay] = useState<ViewEntry[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

        const [listingsSnap, usersSnap, reportsSnap, reviewsSnap] = await Promise.all([
          getDocs(query(collection(db, "listings"), where("createdAt", ">=", thirtyDaysAgo))),
          getDocs(collection(db, "users")),
          getDocs(query(collection(db, "reports"), where("status", "==", "pending"))),
          getDocs(collection(db, "reviews")),
        ]);

        setStats({
          totalUsers:     usersSnap.size,
          totalListings:  listingsSnap.size,
          pendingReports: reportsSnap.size,
          totalReviews:   reviewsSnap.size,
        });

        const days = buildDayRange();
        const countMap: Record<string, number> = {};
        const viewMap:  Record<string, number> = {};
        const typeMap:  Record<string, number> = {};
        days.forEach((d) => { countMap[d] = 0; viewMap[d] = 0; });

        listingsSnap.docs.forEach((d) => {
          const data = d.data();
          const k = dateKey(data.createdAt as number);
          if (k in countMap) countMap[k]++;
          if (k in viewMap)  viewMap[k]  += (data.viewCount ?? 0) as number;
          const type = (data.type ?? "other") as string;
          typeMap[type] = (typeMap[type] ?? 0) + 1;
        });

        setListingsPerDay(days.map((date) => ({ date, count: countMap[date] ?? 0 })));
        setViewsPerDay(days.map((date) => ({ date, views: viewMap[date] ?? 0 })));
        setTypeDistribution(
          Object.entries(typeMap).map(([name, value]) => ({ name, value }))
        );
      } catch (err) {
        console.error("[AnalyticsPage] load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">Analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Platform overview — last 30 days
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users"       value={stats?.totalUsers ?? 0}     color="bg-blue-500" />
        <StatCard icon={List}  label="Listings (30d)"    value={stats?.totalListings ?? 0}  color="bg-green-500" />
        <StatCard icon={Flag}  label="Pending Reports"   value={stats?.pendingReports ?? 0} color="bg-red-500" />
        <StatCard icon={Star}  label="Total Reviews"     value={stats?.totalReviews ?? 0}   color="bg-amber-500" />
      </div>

      {/* Chart 1 — Listings Posted Per Day */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
          Listings Posted (Last 30 Days)
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={listingsPerDay} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              interval={4}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 12, border: "none",
                              boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}
            />
            <Bar dataKey="count" name="Listings" fill="#003366" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2 — Listing Type Distribution */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
          Listings by Type
        </h2>
        {typeDistribution.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={typeDistribution}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  name ? `${TYPE_LABELS[name] ?? name} ${((percent ?? 0) * 100).toFixed(0)}%` : ""
                }
                labelLine={false}
              >
                {typeDistribution.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={TYPE_COLORS[entry.name] ?? `hsl(${i * 60},60%,50%)`}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, n) => [v, TYPE_LABELS[n as string] ?? n]}
                contentStyle={{ fontSize: 12, borderRadius: 12, border: "none",
                                boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}
              />
              <Legend
                formatter={(v) => TYPE_LABELS[v] ?? v}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart 3 — Views Per Day */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
          Total Views (Last 30 Days)
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={viewsPerDay} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              interval={4}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 12, border: "none",
                              boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}
            />
            <Line
              type="monotone"
              dataKey="views"
              name="Views"
              stroke="#0055CC"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
