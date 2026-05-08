import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Loader2 } from "lucide-react";
const EMPTY_FORM = {
    businessName: "", tagline: "", imageUrl: "", ctaLabel: "",
    ctaUrl: "", category: "", startsAt: "", endsAt: "",
    timesPerHour: "3", durationHours: "24",
};
export default function AdsPage() {
    const { adminUser, isAdmin, isEditor } = useAuth();
    const [ads, setAds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    async function load() {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, "ads"));
            setAds(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            console.error(e);
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); }, []);
    function openCreate() {
        setEditId(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    }
    function openEdit(ad) {
        setEditId(ad.id);
        setForm({
            businessName: ad.businessName,
            tagline: ad.tagline,
            imageUrl: ad.imageUrl,
            ctaLabel: ad.ctaLabel,
            ctaUrl: ad.ctaUrl,
            category: ad.category || "",
            startsAt: new Date(ad.startsAt).toISOString().split("T")[0],
            endsAt: new Date(ad.endsAt).toISOString().split("T")[0],
            timesPerHour: String(ad.timesPerHour ?? 3),
            durationHours: String(ad.durationHours ?? 24),
        });
        setShowForm(true);
    }
    async function save() {
        if (!adminUser)
            return;
        setSaving(true);
        const data = {
            businessName: form.businessName.trim(),
            tagline: form.tagline.trim(),
            imageUrl: form.imageUrl.trim(),
            ctaLabel: form.ctaLabel.trim(),
            ctaUrl: form.ctaUrl.trim(),
            category: form.category.trim(),
            startsAt: new Date(form.startsAt).getTime(),
            endsAt: new Date(form.endsAt).getTime(),
            timesPerHour: Math.min(10, Math.max(1, parseInt(form.timesPerHour, 10) || 3)),
            durationHours: Math.min(24, Math.max(1, parseInt(form.durationHours, 10) || 24)),
            updatedAt: Date.now(),
            createdByEmail: adminUser.email,
        };
        try {
            await Promise.race([
                editId
                    ? updateDoc(doc(db, "ads", editId), data)
                    : addDoc(collection(db, "ads"), {
                        ...data,
                        isActive: true,
                        impressions: 0,
                        clicks: 0,
                        createdBy: adminUser.uid,
                        createdAt: Date.now(),
                    }),
                new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 6000)),
            ]);
            setShowForm(false);
            await load();
        }
        catch (e) {
            console.error("[AdsPage] save failed:", e);
            alert("Failed to save ad. Check the console for details. This is usually a Firestore permission or network error.");
        }
        finally {
            setSaving(false);
        }
    }
    async function toggleActive(ad) {
        await Promise.race([
            updateDoc(doc(db, "ads", ad.id), { isActive: !ad.isActive, updatedAt: Date.now() }),
            new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 6000)),
        ]);
        setAds(prev => prev.map(a => a.id === ad.id ? { ...a, isActive: !a.isActive } : a));
    }
    async function deleteAd(id) {
        if (!isAdmin)
            return;
        if (!confirm("Delete this ad? This cannot be undone."))
            return;
        await deleteDoc(doc(db, "ads", id));
        setAds(prev => prev.filter(a => a.id !== id));
    }
    const isValid = form.businessName && form.tagline && form.imageUrl &&
        form.ctaLabel && form.ctaUrl && form.startsAt && form.endsAt;
    const FORM_FIELDS = [
        { key: "businessName", label: "Business Name", placeholder: "e.g. Campus Café" },
        { key: "tagline", label: "Tagline", placeholder: "e.g. Best coffee on campus!" },
        { key: "imageUrl", label: "Image URL", placeholder: "https://example.com/image.jpg" },
        { key: "ctaLabel", label: "Button Label", placeholder: "e.g. Visit Now" },
        { key: "ctaUrl", label: "Button URL", placeholder: "https://..." },
        { key: "category", label: "Category (optional)", placeholder: "e.g. Food" },
    ];
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-5", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-slate-800 dark:text-slate-200", children: "Sponsored Ads" }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-0.5", children: "Manage ads shown in the main marketplace feed" })] }), isEditor && (_jsxs("button", { onClick: openCreate, className: "flex items-center gap-2 bg-blue-600 hover:bg-blue-700\n                             text-white font-medium rounded-xl px-4 min-h-[44px] text-sm\n                             transition-colors", children: [_jsx(Plus, { className: "w-4 h-4" }), " New Ad"] }))] }), showForm && (_jsx("div", { className: "fixed inset-0 z-50 bg-black/50 flex items-center\n                        justify-center p-4", children: _jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full\n                          max-w-lg max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b\n                            border-gray-100 dark:border-slate-700 sticky top-0\n                            bg-white dark:bg-slate-800 z-10", children: [_jsx("h2", { className: "font-semibold text-slate-800 dark:text-slate-200 text-sm", children: editId ? "Edit Ad" : "Create New Ad" }), _jsx("button", { onClick: () => setShowForm(false), className: "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300\n                                 min-h-[44px] flex items-center justify-center w-8", children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsxs("div", { className: "p-5 space-y-3", children: [FORM_FIELDS.map(({ key, label, placeholder }) => (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-slate-600 dark:text-slate-400\n                                    block mb-1", children: label }), _jsx("input", { value: form[key], onChange: e => setForm(f => ({ ...f, [key]: e.target.value })), placeholder: placeholder, className: "w-full bg-slate-50 dark:bg-slate-700 border border-gray-200\n                               dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm\n                               min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500\n                               text-slate-800 dark:text-slate-200" })] }, key))), _jsx("div", { className: "grid grid-cols-2 gap-3", children: [
                                        { key: "startsAt", label: "Start Date" },
                                        { key: "endsAt", label: "End Date" },
                                    ].map(({ key, label }) => (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-slate-600 dark:text-slate-400\n                                      block mb-1", children: label }), _jsx("input", { type: "date", value: form[key], onChange: e => setForm(f => ({ ...f, [key]: e.target.value })), className: "w-full bg-slate-50 dark:bg-slate-700 border border-gray-200\n                                 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm\n                                 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500\n                                 text-slate-800 dark:text-slate-200" })] }, key))) }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsxs("label", { className: "text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1", children: ["Times Per Hour", _jsx("span", { className: "ml-1 text-slate-400 font-normal", children: "(1\u201310)" })] }), _jsx("input", { type: "number", min: 1, max: 10, value: form.timesPerHour, onChange: e => setForm(f => ({ ...f, timesPerHour: e.target.value })), className: "w-full bg-slate-50 dark:bg-slate-700 border border-gray-200\n                               dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm\n                               min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500\n                               text-slate-800 dark:text-slate-200" }), _jsx("p", { className: "text-[10px] text-slate-400 mt-1", children: "Max appearances per hour of browsing" })] }), _jsxs("div", { children: [_jsxs("label", { className: "text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1", children: ["Active Hours/Day", _jsx("span", { className: "ml-1 text-slate-400 font-normal", children: "(1\u201324)" })] }), _jsx("input", { type: "number", min: 1, max: 24, value: form.durationHours, onChange: e => setForm(f => ({ ...f, durationHours: e.target.value })), className: "w-full bg-slate-50 dark:bg-slate-700 border border-gray-200\n                               dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm\n                               min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500\n                               text-slate-800 dark:text-slate-200" }), _jsx("p", { className: "text-[10px] text-slate-400 mt-1", children: "Hours per day this ad is shown" })] })] }), _jsx("button", { onClick: save, disabled: saving || !isValid, className: "w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50\n                           disabled:cursor-not-allowed text-white font-semibold\n                           rounded-xl min-h-[44px] flex items-center justify-center\n                           gap-2 text-sm transition-colors mt-2", children: saving
                                        ? _jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-4 h-4 animate-spin" }), " Saving\u2026"] })
                                        : editId ? "Save Changes" : "Create Ad" })] })] }) })), loading ? (_jsx("div", { className: "space-y-3", children: [...Array(3)].map((_, i) => (_jsx("div", { className: "h-24 bg-white dark:bg-slate-800 rounded-2xl\n                                    animate-pulse border border-gray-100 dark:border-slate-700" }, i))) })) : ads.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center py-20 text-center", children: [_jsx("span", { className: "text-5xl mb-3", children: "\uD83D\uDCE2" }), _jsx("p", { className: "font-semibold text-slate-700 dark:text-slate-300", children: "No ads yet" }), _jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-1", children: "Create an ad to display it in the marketplace feed" })] })) : (_jsx("div", { className: "space-y-3", children: ads.map(ad => (_jsxs("div", { className: "bg-white dark:bg-slate-800 rounded-2xl p-4 border\n                            border-gray-100 dark:border-slate-700 flex items-center gap-4", children: [ad.imageUrl && (_jsx("img", { src: ad.imageUrl, alt: ad.businessName, onError: e => { e.target.style.display = "none"; }, className: "w-16 h-12 rounded-xl object-cover flex-shrink-0 bg-slate-100" })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-0.5", children: [_jsx("p", { className: "font-semibold text-sm text-slate-800 dark:text-slate-200", children: ad.businessName }), _jsx("span", { className: `text-[10px] px-1.5 py-0.5 rounded-full font-medium
                    ${ad.isActive
                                                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                                : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"}`, children: ad.isActive ? "Active" : "Paused" })] }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 truncate", children: ad.tagline }), _jsxs("p", { className: "text-[10px] text-slate-400 mt-0.5", children: [new Date(ad.startsAt).toLocaleDateString(), " \u2192", " ", new Date(ad.endsAt).toLocaleDateString(), " · ", ad.impressions ?? 0, " impressions \u00B7 ", ad.clicks ?? 0, " clicks", " · ", ad.timesPerHour ?? 3, "\u00D7/hr \u00B7 ", ad.durationHours ?? 24, "h/day"] })] }), _jsxs("div", { className: "flex items-center gap-1 flex-shrink-0", children: [_jsx("button", { onClick: () => toggleActive(ad), title: ad.isActive ? "Pause ad" : "Activate ad", className: "text-slate-400 hover:text-blue-500 min-h-[44px]\n                             flex items-center justify-center w-10 transition-colors", children: ad.isActive
                                        ? _jsx(ToggleRight, { className: "w-5 h-5 text-green-500" })
                                        : _jsx(ToggleLeft, { className: "w-5 h-5" }) }), isEditor && (_jsx("button", { onClick: () => openEdit(ad), title: "Edit ad", className: "text-slate-400 hover:text-blue-500 min-h-[44px]\n                               flex items-center justify-center w-10 transition-colors", children: _jsx(Pencil, { className: "w-4 h-4" }) })), isAdmin && (_jsx("button", { onClick: () => deleteAd(ad.id), title: "Delete ad", className: "text-slate-400 hover:text-red-500 min-h-[44px]\n                               flex items-center justify-center w-10 transition-colors", children: _jsx(Trash2, { className: "w-4 h-4" }) }))] })] }, ad.id))) }))] }));
}
