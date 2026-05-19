import { useEffect, useState, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  ResponsiveContainer,
} from "recharts";
import {
  Users, List, Flag, Store, CheckCircle, Loader2,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface DayEntry    { date: string; count: number }
interface SignupEntry { date: string; signups: number }
interface ViewEntry   { date: string; views: number }
interface TypeEntry   { name: string; value: number }

interface Stats {
  totalUsers: number;
  totalListings: number;
  pendingReports: number;
  resolvedReports: number;
  totalShops: number;
}

type Range = 7 | 30 | 90;

// ── Constants ────────────────────────────────────────────────────────────────

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

const TOOLTIP_STYLE = {
  fontSize: 12, borderRadius: 12, border: "none",
  boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function dateKey(ms: number, range: Range): string {
  if (range === 90) {
    const d = new Date(ms);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    return weekStart.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
  }
  return new Date(ms).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

function buildDayRange(range: Range): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const ms = d.getTime();
    const k = dateKey(ms, range);
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }
  return keys;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: number | string;
  sub?: string; color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border
                    border-gray-100 dark:border-slate-700">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center
                       justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      {sub && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border
                    border-gray-100 dark:border-slate-700">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>(30);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [listingsPerDay, setListingsPerDay]   = useState<DayEntry[]>([]);
  const [signupsPerDay, setSignupsPerDay]     = useState<SignupEntry[]>([]);
  const [typeDistribution, setTypeDistribution] = useState<TypeEntry[]>([]);
  const [viewsPerDay, setViewsPerDay]         = useState<ViewEntry[]>([]);

  const load = useCallback(async (selectedRange: Range) => {
    setLoading(true);
    try {
      const since = Date.now() - selectedRange * 24 * 60 * 60 * 1000;

      let resolvedReports = 0;
      const [
        listingsSnap,
        usersSnap,
        pendingReportsSnap,
        shopsSnap,
        recentUsersSnap,
      ] = await Promise.all([
        getDocs(query(
          collection(db, "listings"),
          where("createdAt", ">=", since),
        )),
        getDocs(collection(db, "users")),
        getDocs(query(collection(db, "reports"), where("status", "==", "pending"))),
        getDocs(collection(db, "shops")),
        getDocs(query(
          collection(db, "users"),
          where("createdAt", ">=", since),
        )),
      ]);

      try {
        const resolvedSnap = await getDocs(query(
          collection(db, "reports"),
          where("status", "in", ["resolved", "dismissed", "actioned"]),
        ));
        resolvedReports = resolvedSnap.size;
      } catch (err) {
        console.warn("[AnalyticsPage] resolved reports query failed (index may be missing):", err);
      }

      setStats({
        totalUsers:       usersSnap.size,
        totalListings:    listingsSnap.size,
        pendingReports:   pendingReportsSnap.size,
        resolvedReports,
        totalShops:       shopsSnap.size,
      });

      const days = buildDayRange(selectedRange);
      const countMap:  Record<string, number> = {};
      const viewMap:   Record<string, number> = {};
      const signupMap: Record<string, number> = {};
      const typeMap:   Record<string, number> = {};
      days.forEach((d) => { countMap[d] = 0; viewMap[d] = 0; signupMap[d] = 0; });

      listingsSnap.docs.forEach((d) => {
        const data = d.data();
        const k = dateKey(data.createdAt as number, selectedRange);
        if (k in countMap) countMap[k]++;
        if (k in viewMap)  viewMap[k]  += (data.viewCount ?? 0) as number;
        const type = (data.type ?? "other") as string;
        typeMap[type] = (typeMap[type] ?? 0) + 1;
      });

      recentUsersSnap.docs.forEach((d) => {
        const data = d.data();
        const k = dateKey(data.createdAt as number, selectedRange);
        if (k in signupMap) signupMap[k]++;
      });

      setListingsPerDay(days.map((date) => ({ date, count: countMap[date] ?? 0 })));
      setViewsPerDay(days.map((date)    => ({ date, views:  viewMap[date]   ?? 0 })));
      setSignupsPerDay(days.map((date)  => ({ date, signups: signupMap[date] ?? 0 })));
      setTypeDistribution(
        Object.entries(typeMap).map(([name, value]) => ({ name, value }))
      );
    } catch (err) {
      console.error("[AnalyticsPage] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const resolutionRate = stats
    ? stats.resolvedReports + stats.pendingReports > 0
      ? Math.round(
          (stats.resolvedReports / (stats.resolvedReports + stats.pendingReports)) * 100
        )
      : 0
    : 0;

  return (
    <div className="p-6 space-y-6">

      {/* Header + range selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
            Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Platform overview — last {range} days
          </p>
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {([7, 30, 90] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[36px]
                ${range === r
                  ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard
              icon={Users}
              label="Total Users"
              value={stats?.totalUsers ?? 0}
              color="bg-blue-500"
            />
            <StatCard
              icon={List}
              label={`Listings (${range}d)`}
              value={stats?.totalListings ?? 0}
              color="bg-green-500"
            />
            <StatCard
              icon={Store}
              label="Total Shops"
              value={stats?.totalShops ?? 0}
              color="bg-teal-500"
            />
            <StatCard
              icon={Flag}
              label="Pending Reports"
              value={stats?.pendingReports ?? 0}
              color="bg-red-500"
            />
            <StatCard
              icon={CheckCircle}
              label="Report Resolution"
              value={`${resolutionRate}%`}
              sub={`${stats?.resolvedReports ?? 0} resolved`}
              color="bg-purple-500"
            />
          </div>

          {/* Chart 1 — Listings Posted Per Day */}
          <ChartCard title={`Listings Posted (Last ${range} Days)`}>
            {listingsPerDay.every((d) => d.count === 0) ? (
              <p className="text-sm text-slate-400 text-center py-8">
                No listings in this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={listingsPerDay}
                  margin={{ top: 0, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    interval={range === 7 ? 0 : range === 30 ? 4 : 1}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Listings" fill="#003366" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Chart 2 — User Sign-ups Per Day */}
          <ChartCard title={`New User Sign-ups (Last ${range} Days)`}>
            {signupsPerDay.every((d) => d.signups === 0) ? (
              <p className="text-sm text-slate-400 text-center py-8">
                No sign-ups in this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={signupsPerDay}
                  margin={{ top: 0, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    interval={range === 7 ? 0 : range === 30 ? 4 : 1}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar
                    dataKey="signups"
                    name="Sign-ups"
                    fill="#0D9488"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Chart 3 — Listing Type Distribution */}
          <ChartCard title="Listings by Type">
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
                      name
                        ? `${TYPE_LABELS[name] ?? name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        : ""
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
                    contentStyle={TOOLTIP_STYLE}
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
          </ChartCard>

          {/* Chart 4 — Views Per Day */}
          <ChartCard title={`Total Listing Views (Last ${range} Days)`}>
            {viewsPerDay.every((d) => d.views === 0) ? (
              <p className="text-sm text-slate-400 text-center py-8">
                No view data in this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={viewsPerDay}
                  margin={{ top: 0, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    interval={range === 7 ? 0 : range === 30 ? 4 : 1}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
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
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}
