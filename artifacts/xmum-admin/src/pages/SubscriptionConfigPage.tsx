import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Settings, Save, RefreshCw, Info } from "lucide-react";

interface Config {
  launchDate: number;
  trialDays: number;
  subscriptionDays: number;
  graceDays: number;
}

const DEFAULTS: Config = {
  launchDate:       0,
  trialDays:        60,
  subscriptionDays: 30,
  graceDays:        30,
};

function toDateInputValue(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

function fromDateInputValue(val: string): number {
  if (!val) return 0;
  return new Date(val).getTime();
}

export default function SubscriptionConfigPage() {
  const [config, setConfig]   = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const snap = await getDoc(doc(db, "appConfig", "subscriptions"));
      if (snap.exists()) {
        const d = snap.data();
        setConfig({
          launchDate:       d.launchDate       ?? 0,
          trialDays:        d.trialDays        ?? DEFAULTS.trialDays,
          subscriptionDays: d.subscriptionDays ?? DEFAULTS.subscriptionDays,
          graceDays:        d.graceDays        ?? DEFAULTS.graceDays,
        });
      } else {
        setConfig(DEFAULTS);
      }
    } catch (e: any) {
      setError("Failed to load config: " + (e?.message ?? "unknown error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await setDoc(doc(db, "appConfig", "subscriptions"), config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError("Failed to save: " + (e?.message ?? "unknown error"));
    } finally {
      setSaving(false);
    }
  }

  const trialEndDate = config.launchDate
    ? new Date(config.launchDate + config.trialDays * 24 * 60 * 60 * 1000)
        .toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const inputCls =
    "w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 " +
    "rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px]";
  const labelCls = "block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1";

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#003366] flex items-center justify-center">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
            Subscription Config
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Controls the free trial window, subscription length, and grace period for Campus Market shops.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800
                      rounded-2xl p-4 mb-6 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <p>
            <strong>Launch Date</strong> — The date your platform officially launched.
            All shops approved before <em>Launch Date + Trial Days</em> get a free trial that ends on that date.
            After the trial window, newly approved shops get a paid subscription of <em>Subscription Days</em> length.
          </p>
          <p>
            <strong>Grace Period</strong> — After a subscription expires, shops enter a grace period before being permanently deactivated.
            During grace, the shop is hidden but can be reactivated by renewing.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-white dark:bg-slate-800 rounded-2xl animate-pulse
                                    border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">

          {/* Launch Date */}
          <div>
            <label className={labelCls}>
              Platform Launch Date
            </label>
            <input
              type="date"
              value={toDateInputValue(config.launchDate)}
              onChange={(e) => setConfig({ ...config, launchDate: fromDateInputValue(e.target.value) })}
              className={inputCls}
            />
            <p className="text-xs text-slate-400 mt-1">
              The date XMUM Campus Market was officially opened to students.
              Leave blank if you want all shops to get paid subscriptions immediately.
            </p>
          </div>

          {/* Trial Days */}
          <div>
            <label className={labelCls}>
              Free Trial Length (days)
            </label>
            <input
              type="number"
              min={0}
              max={365}
              value={config.trialDays}
              onChange={(e) => setConfig({ ...config, trialDays: Math.max(0, parseInt(e.target.value) || 0) })}
              className={inputCls}
            />
            {trialEndDate && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Trial ends on <strong>{trialEndDate}</strong> — any shop approved before that date gets a free trial.
              </p>
            )}
          </div>

          {/* Subscription Days */}
          <div>
            <label className={labelCls}>
              Subscription Length (days)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={config.subscriptionDays}
              onChange={(e) => setConfig({ ...config, subscriptionDays: Math.max(1, parseInt(e.target.value) || 1) })}
              className={inputCls}
            />
            <p className="text-xs text-slate-400 mt-1">
              How long a paid subscription lasts after approval or renewal. Typically 30 days.
            </p>
          </div>

          {/* Grace Days */}
          <div>
            <label className={labelCls}>
              Grace Period (days)
            </label>
            <input
              type="number"
              min={0}
              max={90}
              value={config.graceDays}
              onChange={(e) => setConfig({ ...config, graceDays: Math.max(0, parseInt(e.target.value) || 0) })}
              className={inputCls}
            />
            <p className="text-xs text-slate-400 mt-1">
              Days after expiry before the shop is permanently deactivated. Set to 0 to deactivate immediately.
            </p>
          </div>

          {/* Summary card */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100
                          dark:border-slate-700 p-4 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Summary</p>
            {config.launchDate > 0 ? (
              <p>🎉 Shops approved during the trial window get <strong>{config.trialDays} days free</strong>, ending on <strong>{trialEndDate}</strong>.</p>
            ) : (
              <p>ℹ️ No launch date set — all approved shops start on a paid subscription immediately.</p>
            )}
            <p>📅 After the trial (or for new shops after the trial window), subscriptions last <strong>{config.subscriptionDays} days</strong>.</p>
            <p>⏳ Expired shops get a <strong>{config.graceDays}-day grace period</strong> before permanent deactivation.</p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                            rounded-xl px-4 py-3 text-xs text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-[#003366] text-white rounded-xl px-5 py-2.5
                         text-sm font-semibold hover:bg-[#002244] transition disabled:opacity-60
                         min-h-[40px]"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Config"}
            </button>
            {saved && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                ✓ Saved successfully
              </span>
            )}
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400
                         dark:hover:text-slate-200 transition"
            >
              Reset
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
