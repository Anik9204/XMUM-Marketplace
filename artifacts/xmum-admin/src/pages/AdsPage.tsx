import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc,
         doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { SponsoredAd } from "../lib/types";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Loader2 } from "lucide-react";

const EMPTY_FORM = {
  businessName: "", tagline: "", imageUrl: "", ctaLabel: "",
  ctaUrl: "", category: "", startsAt: "", endsAt: "",
};

export default function AdsPage() {
  const { adminUser, isAdmin, isEditor } = useAuth();
  const [ads, setAds] = useState<SponsoredAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "ads"));
      setAds(snap.docs.map(d => ({ id: d.id, ...d.data() } as SponsoredAd)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(ad: SponsoredAd) {
    setEditId(ad.id);
    setForm({
      businessName: ad.businessName,
      tagline:      ad.tagline,
      imageUrl:     ad.imageUrl,
      ctaLabel:     ad.ctaLabel,
      ctaUrl:       ad.ctaUrl,
      category:     ad.category || "",
      startsAt:     new Date(ad.startsAt).toISOString().split("T")[0],
      endsAt:       new Date(ad.endsAt).toISOString().split("T")[0],
    });
    setShowForm(true);
  }

  async function save() {
    if (!adminUser) return;
    setSaving(true);
    const data = {
      businessName:   form.businessName.trim(),
      tagline:        form.tagline.trim(),
      imageUrl:       form.imageUrl.trim(),
      ctaLabel:       form.ctaLabel.trim(),
      ctaUrl:         form.ctaUrl.trim(),
      category:       form.category.trim(),
      startsAt:       new Date(form.startsAt).getTime(),
      endsAt:         new Date(form.endsAt).getTime(),
      updatedAt:      Date.now(),
      createdByEmail: adminUser.email,
    };
    try {
      await Promise.race([
        editId
          ? updateDoc(doc(db, "ads", editId), data)
          : addDoc(collection(db, "ads"), {
              ...data,
              isActive:    true,
              impressions: 0,
              clicks:      0,
              createdBy:   adminUser.uid,
              createdAt:   Date.now(),
            }),
        new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 6000)),
      ]);
      setShowForm(false);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(ad: SponsoredAd) {
    await Promise.race([
      updateDoc(doc(db, "ads", ad.id), { isActive: !ad.isActive, updatedAt: Date.now() }),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 6000)),
    ]);
    setAds(prev => prev.map(a => a.id === ad.id ? { ...a, isActive: !a.isActive } : a));
  }

  async function deleteAd(id: string) {
    if (!isAdmin) return;
    if (!confirm("Delete this ad? This cannot be undone.")) return;
    await deleteDoc(doc(db, "ads", id));
    setAds(prev => prev.filter(a => a.id !== id));
  }

  const isValid = form.businessName && form.tagline && form.imageUrl &&
                  form.ctaLabel && form.ctaUrl && form.startsAt && form.endsAt;

  const FORM_FIELDS = [
    { key: "businessName", label: "Business Name", placeholder: "e.g. Campus Café" },
    { key: "tagline",      label: "Tagline",        placeholder: "e.g. Best coffee on campus!" },
    { key: "imageUrl",     label: "Image URL",      placeholder: "https://example.com/image.jpg" },
    { key: "ctaLabel",     label: "Button Label",   placeholder: "e.g. Visit Now" },
    { key: "ctaUrl",       label: "Button URL",     placeholder: "https://..." },
    { key: "category",     label: "Category (optional)", placeholder: "e.g. Food" },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
            Sponsored Ads
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage ads shown in the main marketplace feed
          </p>
        </div>
        {isEditor && (
          <button onClick={openCreate}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700
                             text-white font-medium rounded-xl px-4 min-h-[44px] text-sm
                             transition-colors">
            <Plus className="w-4 h-4" /> New Ad
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center
                        justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full
                          max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b
                            border-gray-100 dark:border-slate-700 sticky top-0
                            bg-white dark:bg-slate-800 z-10">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                {editId ? "Edit Ad" : "Create New Ad"}
              </h2>
              <button onClick={() => setShowForm(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
                                 min-h-[44px] flex items-center justify-center w-8">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {FORM_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400
                                    block mb-1">
                    {label}
                  </label>
                  <input
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-gray-200
                               dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm
                               min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500
                               text-slate-800 dark:text-slate-200"
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: "startsAt", label: "Start Date" },
                  { key: "endsAt",   label: "End Date" },
                ] as const).map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400
                                      block mb-1">
                      {label}
                    </label>
                    <input
                      type="date"
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-700 border border-gray-200
                                 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm
                                 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500
                                 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={save}
                disabled={saving || !isValid}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                           disabled:cursor-not-allowed text-white font-semibold
                           rounded-xl min-h-[44px] flex items-center justify-center
                           gap-2 text-sm transition-colors mt-2">
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : editId ? "Save Changes" : "Create Ad"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-white dark:bg-slate-800 rounded-2xl
                                    animate-pulse border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : ads.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <span className="text-5xl mb-3">📢</span>
          <p className="font-semibold text-slate-700 dark:text-slate-300">No ads yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create an ad to display it in the marketplace feed
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map(ad => (
            <div key={ad.id}
                 className="bg-white dark:bg-slate-800 rounded-2xl p-4 border
                            border-gray-100 dark:border-slate-700 flex items-center gap-4">
              {ad.imageUrl && (
                <img
                  src={ad.imageUrl}
                  alt={ad.businessName}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  className="w-16 h-12 rounded-xl object-cover flex-shrink-0 bg-slate-100"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                    {ad.businessName}
                  </p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                    ${ad.isActive
                      ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"}`}>
                    {ad.isActive ? "Active" : "Paused"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {ad.tagline}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {new Date(ad.startsAt).toLocaleDateString()} →{" "}
                  {new Date(ad.endsAt).toLocaleDateString()}
                  {" · "}{ad.impressions ?? 0} impressions · {ad.clicks ?? 0} clicks
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleActive(ad)}
                  title={ad.isActive ? "Pause ad" : "Activate ad"}
                  className="text-slate-400 hover:text-blue-500 min-h-[44px]
                             flex items-center justify-center w-10 transition-colors">
                  {ad.isActive
                    ? <ToggleRight className="w-5 h-5 text-green-500" />
                    : <ToggleLeft className="w-5 h-5" />}
                </button>
                {isEditor && (
                  <button
                    onClick={() => openEdit(ad)}
                    title="Edit ad"
                    className="text-slate-400 hover:text-blue-500 min-h-[44px]
                               flex items-center justify-center w-10 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => deleteAd(ad.id)}
                    title="Delete ad"
                    className="text-slate-400 hover:text-red-500 min-h-[44px]
                               flex items-center justify-center w-10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
