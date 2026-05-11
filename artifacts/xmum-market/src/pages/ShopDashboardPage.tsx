import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  getShopById, getShopListings, createShopListing, updateShopListing, deleteShopListing,
  uploadShopListingPhoto, getInquiriesForShop, updateInquiryStatus,
  addShopEditor, removeShopEditor, updateShop, uploadShopBanner, uploadShopLogo,
} from "@/lib/shops";
import { collection, query, where, getDocs, limit, getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Shop, ShopListing, ShopInquiry, ShopCategory, InquiryStatus } from "@/lib/types";
import {
  Loader2, Plus, Trash2, Edit2, CheckCircle2, XCircle, Clock, Package,
  MessageSquare, Users, Settings, ArrowLeft, ImagePlus, X, AlertTriangle,
  Store, UserMinus, UserPlus, Camera,
} from "lucide-react";

const SHOP_CATEGORIES: ShopCategory[] = [
  "Food & Beverage", "Tutoring & Education", "Fashion & Apparel", "Electronics",
  "Beauty & Wellness", "Transport & Rental", "Handmade & Custom", "Books & Stationery",
  "Services", "Travel & Lifestyle", "Others",
];

const inputCls = "w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-h-[44px]";
const labelCls = "block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1";

type Tab = "listings" | "inquiries" | "editors" | "settings";

function StatusBadge({ status }: { status: InquiryStatus }) {
  const map: Record<InquiryStatus, { label: string; cls: string }> = {
    pending:   { label: "Pending",   cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    confirmed: { label: "Confirmed", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    completed: { label: "Completed", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400" },
  };
  const { label, cls } = map[status];
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function ShopDashboardPage() {
  const [, params] = useRoute("/shop-dashboard/:shopId");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const shopId = params?.shopId ?? "";

  const [shop, setShop] = useState<Shop | null>(null);
  const [loadingShop, setLoadingShop] = useState(true);
  const [tab, setTab] = useState<Tab>("listings");

  // Listings state
  const [listings, setListings] = useState<ShopListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [showAddListing, setShowAddListing] = useState(false);
  const [pendingInquiryCount, setPendingInquiryCount] = useState(0);

  // Inquiries state
  const [inquiries, setInquiries] = useState<ShopInquiry[]>([]);
  const [loadingInquiries, setLoadingInquiries] = useState(false);

  // Editors state
  const [editorEmail, setEditorEmail] = useState("");
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState("");

  // Settings state
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsBio, setSettingsBio] = useState("");
  const [settingsCategory, setSettingsCategory] = useState<ShopCategory>("Others");
  const [settingsWhatsApp, setSettingsWhatsApp] = useState("");
  const [settingsWeChat, setSettingsWeChat] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load shop
  useEffect(() => {
    if (!shopId) return;
    setLoadingShop(true);
    getShopById(shopId).then(async (s) => {
      setShop(s);
      if (s) {
        setSettingsName(s.name);
        setSettingsBio(s.bio);
        setSettingsCategory(s.category);
        setSettingsWhatsApp(s.whatsapp ?? "");
        setSettingsWeChat(s.wechat ?? "");
        try {
          const inqs = await getInquiriesForShop(shopId);
          setPendingInquiryCount(inqs.filter((i) => i.status === "pending").length);
        } catch {}
      }
    }).finally(() => setLoadingShop(false));
  }, [shopId]);

  // Load tab data
  useEffect(() => {
    if (!shop) return;
    if (tab === "listings") {
      setLoadingListings(true);
      getShopListings(shopId).then(setListings).finally(() => setLoadingListings(false));
    }
    if (tab === "inquiries") {
      setLoadingInquiries(true);
      getInquiriesForShop(shopId).then(setInquiries).finally(() => setLoadingInquiries(false));
    }
  }, [tab, shop]);

  if (loadingShop) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-[#003366] dark:text-blue-400" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Store size={40} className="mx-auto text-gray-300 dark:text-slate-600 mb-3" />
        <p className="text-gray-500 dark:text-slate-400">Shop not found.</p>
        <Link href="/" className="text-[#003366] dark:text-blue-400 text-sm underline mt-2 inline-block">Go home</Link>
      </div>
    );
  }

  const isOwner = user?.uid === shop.ownerId;
  const isEditor = shop.editorIds.includes(user?.uid ?? "");

  if (!isOwner && !isEditor) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <AlertTriangle size={40} className="mx-auto text-amber-400 mb-3" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">Access Denied</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">You don't have permission to manage this shop.</p>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "listings",  label: "Listings",  icon: <Package size={15} /> },
    { key: "inquiries", label: "Inquiries", icon: <MessageSquare size={15} />, badge: pendingInquiryCount },
    ...(isOwner ? [{ key: "editors" as Tab, label: "Editors", icon: <Users size={15} /> }] : []),
    { key: "settings",  label: "Settings",  icon: <Settings size={15} /> },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/shop/${shop.slug}`} className="text-gray-400 dark:text-slate-500 hover:text-[#003366] dark:hover:text-blue-400 transition">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 truncate">{shop.name}</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400">Shop Dashboard {isOwner ? "(Owner)" : "(Editor)"}</p>
        </div>
        <Link
          href={`/shop/${shop.slug}`}
          className="text-xs text-[#003366] dark:text-blue-400 font-semibold border border-[#003366]/30 dark:border-blue-400/30 px-3 py-1.5 rounded-lg hover:bg-[#003366]/5 transition"
        >
          View Shop
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1 mb-5 gap-1 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              tab === t.key
                ? "bg-white dark:bg-slate-700 shadow text-[#003366] dark:text-slate-100"
                : "text-gray-500 dark:text-slate-400"
            }`}
          >
            {t.icon}{t.label}
            {t.badge ? (
              <span className="ml-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── LISTINGS TAB ── */}
      {tab === "listings" && (
        <ListingsTab
          shopId={shopId}
          shop={shop}
          listings={listings}
          loading={loadingListings}
          showAdd={showAddListing}
          setShowAdd={setShowAddListing}
          onRefresh={() => {
            setLoadingListings(true);
            getShopListings(shopId)
              .then(setListings)
              .catch((err) => console.error("[listings] fetch failed:", err))
              .finally(() => setLoadingListings(false));
          }}
        />
      )}

      {/* ── INQUIRIES TAB ── */}
      {tab === "inquiries" && (
        <InquiriesTab
          inquiries={inquiries}
          loading={loadingInquiries}
          onStatusChange={async (id, status) => {
            await updateInquiryStatus(id, status);
            setInquiries((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
          }}
        />
      )}

      {/* ── EDITORS TAB ── */}
      {tab === "editors" && isOwner && (
        <EditorsTab
          shop={shop}
          editorEmail={editorEmail}
          setEditorEmail={setEditorEmail}
          editorLoading={editorLoading}
          editorError={editorError}
          onAdd={async () => {
            setEditorError("");
            setEditorLoading(true);
            try {
              const q = query(collection(db, "users"), where("email", "==", editorEmail.trim()), limit(1));
              const snap = await getDocs(q);
              if (snap.empty) { setEditorError("No XMUM user found with that email."); return; }
              const uid = snap.docs[0].id;
              await addShopEditor(shopId, uid, shop.editorIds);
              setShop((prev) => prev ? { ...prev, editorIds: [...prev.editorIds, uid] } : prev);
              setEditorEmail("");
            } catch (err: any) {
              setEditorError(err.message ?? "Failed to add editor.");
            } finally {
              setEditorLoading(false);
            }
          }}
          onRemove={async (uid) => {
            await removeShopEditor(shopId, uid, shop.editorIds);
            setShop((prev) => prev ? { ...prev, editorIds: prev.editorIds.filter((e) => e !== uid) } : prev);
          }}
        />
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === "settings" && (
        <SettingsTab
          shop={shop}
          isOwner={isOwner}
          name={settingsName}
          bio={settingsBio}
          category={settingsCategory}
          whatsapp={settingsWhatsApp}
          wechat={settingsWeChat}
          setName={setSettingsName}
          setBio={setSettingsBio}
          setCategory={setSettingsCategory}
          setWhatsApp={setSettingsWhatsApp}
          setWeChat={setSettingsWeChat}
          loading={settingsLoading}
          showDeleteConfirm={showDeleteConfirm}
          setShowDeleteConfirm={setShowDeleteConfirm}
          bannerInputRef={bannerInputRef}
          logoInputRef={logoInputRef}
          onSave={async () => {
            setSettingsLoading(true);
            try {
              await updateShop(shopId, {
                name: settingsName,
                bio: settingsBio,
                category: settingsCategory,
                whatsapp: settingsWhatsApp,
                wechat: settingsWeChat,
              });
              setShop((prev) => prev ? { ...prev, name: settingsName, bio: settingsBio, category: settingsCategory, whatsapp: settingsWhatsApp, wechat: settingsWeChat } : prev);
            } finally {
              setSettingsLoading(false);
            }
          }}
          onBannerUpload={async (file) => {
            const url = await uploadShopBanner(shopId, file);
            await updateShop(shopId, { bannerUrl: url });
            setShop((prev) => prev ? { ...prev, bannerUrl: url } : prev);
          }}
          onLogoUpload={async (file) => {
            const url = await uploadShopLogo(shopId, file);
            await updateShop(shopId, { logoUrl: url });
            setShop((prev) => prev ? { ...prev, logoUrl: url } : prev);
          }}
          onDelete={async () => {
            await updateShop(shopId, { isActive: false });
            navigate("/profile");
          }}
        />
      )}
    </div>
  );
}

// ── Listings Tab ──────────────────────────────────────────────────────────────

function ListingsTab({
  shopId, shop, listings, loading, showAdd, setShowAdd, onRefresh,
}: {
  shopId: string; shop: Shop; listings: ShopListing[]; loading: boolean;
  showAdd: boolean; setShowAdd: (v: boolean) => void; onRefresh: () => void;
}) {
  const [listingAdded, setListingAdded] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">{listings.length} listing{listings.length !== 1 ? "s" : ""}</p>
        <div className="flex items-center gap-2">
          {listingAdded && (
            <span className="text-xs text-green-600 dark:text-green-400 font-semibold animate-in fade-in">
              ✅ Listing added!
            </span>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-[#003366] dark:bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#002244] transition"
          >
            <Plus size={14} /> Add Listing
          </button>
        </div>
      </div>

      {showAdd && (
        <AddListingForm
          shopId={shopId}
          shop={shop}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            setListingAdded(true);
            setTimeout(() => setListingAdded(false), 3000);
            onRefresh();
          }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-gray-400" /></div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">
          <Package size={36} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No listings yet. Add your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((l) => (
            <ListingRow key={l.id} listing={l} shopId={shopId} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function ListingRow({ listing, shopId, onRefresh }: { listing: ShopListing; shopId: string; onRefresh: () => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Archive this listing?")) return;
    setDeleting(true);
    await deleteShopListing(listing.id, shopId);
    onRefresh();
  };

  const priceLabel = listing.price !== undefined
    ? `RM ${listing.price.toFixed(2)}${listing.pricingModel && listing.pricingModel !== "fixed" ? ` / ${listing.pricingModel.replace("_", " ")}` : ""}`
    : "Price N/A";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 flex items-center gap-3">
      {listing.photos[0] ? (
        <img src={listing.photos[0]} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
          <Package size={20} className="text-gray-300 dark:text-slate-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{listing.title}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{priceLabel}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500">{relativeTime(listing.createdAt)}</p>
      </div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition disabled:opacity-40"
      >
        {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </button>
    </div>
  );
}

function AddListingForm({ shopId, shop, onClose, onCreated }: {
  shopId: string; shop: Shop; onClose: () => void; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [pricingModel, setPricingModel] = useState<ShopListing["pricingModel"]>("fixed");
  const [category, setCategory] = useState<ShopCategory>(shop.category);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotos = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files).slice(0, 4 - photos.length);
    setPhotos((p) => [...p, ...picked]);
    picked.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => setPreviews((p) => [...p, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Title is required."); return; }
    setLoading(true);
    try {
      const photoUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const url = await uploadShopListingPhoto(shopId, photos[i], i);
        photoUrls.push(url);
      }
      await createShopListing({
        shopId,
        shopName: shop.name,
        shopSlug: shop.slug,
        shopOwnerId: shop.ownerId,
        title: title.trim(),
        description: description.trim(),
        price: price ? parseFloat(price) : undefined,
        pricingModel,
        category,
        photos: photoUrls,
        isActive: true,
      });
      onCreated();
    } catch (err: any) {
      setError(err.message ?? "Failed to create listing.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-blue-50 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">New Listing</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"><X size={16} /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div>
          <label className={labelCls}>Title <span className="text-red-500">*</span></label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Nasi Lemak Set" maxLength={80} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the item or service..." maxLength={500} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Price (RM)</label>
            <input className={inputCls} type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className={labelCls}>Pricing</label>
            <select className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-h-[44px]" value={pricingModel} onChange={(e) => setPricingModel(e.target.value as ShopListing["pricingModel"])}>
              <option value="fixed">Fixed</option>
              <option value="per_hour">Per Hour</option>
              <option value="per_day">Per Day</option>
              <option value="negotiable">Negotiable</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Category</label>
          <select className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-h-[44px]" value={category} onChange={(e) => setCategory(e.target.value as ShopCategory)}>
            {SHOP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Photos (up to 4)</label>
          <div className="flex flex-wrap gap-2">
            {previews.map((p, i) => (
              <div key={i} className="relative w-16 h-16">
                <img src={p} className="w-16 h-16 object-cover rounded-lg" />
                <button type="button" onClick={() => { setPhotos((a) => a.filter((_, j) => j !== i)); setPreviews((a) => a.filter((_, j) => j !== i)); }} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 text-white"><X size={10} /></button>
              </div>
            ))}
            {photos.length < 4 && (
              <button type="button" onClick={() => fileRef.current?.click()} className="w-16 h-16 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex items-center justify-center text-gray-400 hover:border-[#003366] hover:text-[#003366] transition">
                <ImagePlus size={18} />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotos(e.target.files)} />
          </div>
        </div>
        <button type="submit" disabled={loading} className="w-full min-h-[44px] bg-[#003366] dark:bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-[#002244] disabled:opacity-50 transition flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={15} className="animate-spin" /> Uploading…</> : "Add Listing"}
        </button>
      </form>
    </div>
  );
}

// ── Inquiries Tab ─────────────────────────────────────────────────────────────

function InquiriesTab({ inquiries, loading, onStatusChange }: {
  inquiries: ShopInquiry[]; loading: boolean;
  onStatusChange: (id: string, status: InquiryStatus) => Promise<void>;
}) {
  const [updating, setUpdating] = useState<string | null>(null);

  const handle = async (id: string, status: InquiryStatus) => {
    setUpdating(id + status);
    await onStatusChange(id, status);
    setUpdating(null);
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-gray-400" /></div>;
  if (inquiries.length === 0) return (
    <div className="text-center py-12 text-gray-400 dark:text-slate-500">
      <MessageSquare size={36} className="mx-auto mb-2 opacity-40" />
      <p className="text-sm">No inquiries yet.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {inquiries.map((inq) => (
        <div key={inq.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{inq.listingTitle}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">From: {inq.buyerName} · {relativeTime(inq.createdAt)}</p>
            </div>
            <StatusBadge status={inq.status} />
          </div>
          {inq.note && <p className="text-xs text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-700/50 rounded-lg px-3 py-2 mt-2">"{inq.note}"</p>}
          {inq.quantity && <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Qty: {inq.quantity}</p>}
          {inq.status === "completed" && !inq.reviewLeft && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1 inline-block">Review left: No</span>
          )}
          <div className="flex gap-2 mt-3 flex-wrap">
            {inq.status === "pending" && (
              <>
                <button onClick={() => handle(inq.id, "confirmed")} disabled={updating === inq.id + "confirmed"} className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-200 transition disabled:opacity-40">
                  {updating === inq.id + "confirmed" ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Confirm
                </button>
                <button onClick={() => handle(inq.id, "cancelled")} disabled={updating === inq.id + "cancelled"} className="flex items-center gap-1 text-xs bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 px-3 py-1.5 rounded-lg font-semibold hover:bg-red-100 transition disabled:opacity-40">
                  {updating === inq.id + "cancelled" ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />} Cancel
                </button>
              </>
            )}
            {inq.status === "confirmed" && (
              <button onClick={() => handle(inq.id, "completed")} disabled={updating === inq.id + "completed"} className="flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-3 py-1.5 rounded-lg font-semibold hover:bg-green-200 transition disabled:opacity-40">
                {updating === inq.id + "completed" ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Mark Complete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Editors Tab ───────────────────────────────────────────────────────────────

function EditorsTab({ shop, editorEmail, setEditorEmail, editorLoading, editorError, onAdd, onRemove }: {
  shop: Shop; editorEmail: string; setEditorEmail: (v: string) => void;
  editorLoading: boolean; editorError: string;
  onAdd: () => void; onRemove: (uid: string) => void;
}) {
  const [editorProfiles, setEditorProfiles] = useState<Record<string, { name: string; email: string }>>({});

  useEffect(() => {
    if (!shop.editorIds.length) return;
    Promise.all(
      shop.editorIds.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) {
            const data = snap.data();
            return [uid, { name: data.displayName || data.fullName || "Unknown", email: data.email || "" }] as const;
          }
        } catch {}
        return [uid, { name: "Unknown User", email: uid }] as const;
      })
    ).then((results) => {
      setEditorProfiles(Object.fromEntries(results));
    });
  }, [shop.editorIds]);

  return (
    <div>
      <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">Editors can add/edit/delete listings and manage inquiries. Max 3 editors.</p>
      {shop.editorIds.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">No editors added yet.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {shop.editorIds.map((uid) => (
            <div key={uid} className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                  {editorProfiles[uid]?.name ?? "Loading..."}
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {editorProfiles[uid]?.email ?? uid}
                </p>
              </div>
              <button onClick={() => onRemove(uid)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold transition">
                <UserMinus size={13} /> Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {shop.editorIds.length < 3 && (
        <div className="bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <label className={labelCls}>Add Editor by Email</label>
          <div className="flex gap-2">
            <input
              className={`${inputCls} flex-1`}
              type="email"
              placeholder="student@xmu.edu.my"
              value={editorEmail}
              onChange={(e) => setEditorEmail(e.target.value)}
            />
            <button onClick={onAdd} disabled={editorLoading || !editorEmail.trim()} className="flex items-center gap-1 bg-[#003366] dark:bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-[#002244] disabled:opacity-40 transition whitespace-nowrap">
              {editorLoading ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} Add
            </button>
          </div>
          {editorError && <p className="text-xs text-red-500 mt-1">{editorError}</p>}
        </div>
      )}
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({
  shop, isOwner, name, bio, category, whatsapp, wechat,
  setName, setBio, setCategory, setWhatsApp, setWeChat,
  loading, showDeleteConfirm, setShowDeleteConfirm,
  bannerInputRef, logoInputRef, onSave, onBannerUpload, onLogoUpload, onDelete,
}: {
  shop: Shop; isOwner: boolean;
  name: string; bio: string; category: ShopCategory; whatsapp: string; wechat: string;
  setName: (v: string) => void; setBio: (v: string) => void; setCategory: (v: ShopCategory) => void;
  setWhatsApp: (v: string) => void; setWeChat: (v: string) => void;
  loading: boolean; showDeleteConfirm: boolean; setShowDeleteConfirm: (v: boolean) => void;
  bannerInputRef: React.RefObject<HTMLInputElement | null>; logoInputRef: React.RefObject<HTMLInputElement | null>;
  onSave: () => void; onBannerUpload: (f: File) => void; onLogoUpload: (f: File) => void; onDelete: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleSave = async () => {
    await onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-5">
      {/* Banner / Logo */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div
          className="h-28 relative"
          style={{ background: shop.bannerUrl ? undefined : "linear-gradient(135deg, #003366 0%, #0066cc 100%)" }}
        >
          {shop.bannerUrl && <img src={shop.bannerUrl} alt="" className="w-full h-full object-cover" />}
          <button
            onClick={() => !bannerUploading && bannerInputRef.current?.click()}
            disabled={bannerUploading}
            className="absolute top-2 right-2 bg-black/40 text-white p-1.5 rounded-lg hover:bg-black/60 transition disabled:opacity-60"
          >
            {bannerUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          </button>
          <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
            if (!e.target.files?.[0]) return;
            setUploadError("");
            setBannerUploading(true);
            try { await onBannerUpload(e.target.files[0]); }
            catch (err: any) { setUploadError("Banner upload failed: " + (err?.message ?? "Unknown error")); }
            finally { setBannerUploading(false); }
          }} />
        </div>
        <div className="px-4 pb-4 -mt-6 flex items-end gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-xl border-2 border-white dark:border-slate-800 bg-gray-100 dark:bg-slate-700 overflow-hidden">
              {shop.logoUrl ? <img src={shop.logoUrl} alt="" className="w-full h-full object-cover" /> : <Store size={28} className="text-gray-400 dark:text-slate-500 m-auto mt-3" />}
            </div>
            <button
              onClick={() => !logoUploading && logoInputRef.current?.click()}
              disabled={logoUploading}
              className="absolute -bottom-1 -right-1 bg-[#003366] text-white p-1 rounded-full hover:bg-[#002244] transition disabled:opacity-60"
            >
              {logoUploading ? <Loader2 size={10} className="animate-spin" /> : <Camera size={10} />}
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              if (!e.target.files?.[0]) return;
              setUploadError("");
              setLogoUploading(true);
              try { await onLogoUpload(e.target.files[0]); }
              catch (err: any) { setUploadError("Logo upload failed: " + (err?.message ?? "Unknown error")); }
              finally { setLogoUploading(false); }
            }} />
          </div>
          <div className="pb-1">
            <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{shop.name}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">{shop.category}</p>
          </div>
        </div>
        {uploadError && <p className="text-xs text-red-500 mt-2 px-4 pb-3">{uploadError}</p>}
      </div>

      <div>
        <label className={labelCls}>Shop Name</label>
        <input className={inputCls} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Category</label>
        <select className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-h-[44px]" value={category} onChange={(e) => setCategory(e.target.value as ShopCategory)}>
          {SHOP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Bio</label>
        <textarea className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none" rows={3} maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)} />
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{bio.length}/300</p>
      </div>
      <div>
        <label className={labelCls}>WhatsApp</label>
        <input className={inputCls} placeholder="+60123456789" value={whatsapp} onChange={(e) => setWhatsApp(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>WeChat ID</label>
        <input className={inputCls} placeholder="your_wechat_id" value={wechat} onChange={(e) => setWeChat(e.target.value)} />
      </div>

      <button onClick={handleSave} disabled={loading} className="w-full min-h-[48px] bg-[#003366] dark:bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-[#002244] disabled:opacity-50 transition flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : saved ? <><CheckCircle2 size={15} /> Saved!</> : "Save Changes"}
      </button>

      {isOwner && (
        <div className="border-t border-red-100 dark:border-red-900/30 pt-4">
          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)} className="w-full text-sm text-red-500 border border-red-200 dark:border-red-800 rounded-xl py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition font-semibold">
              Delete Shop
            </button>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Are you sure?</p>
              <p className="text-xs text-red-600 dark:text-red-400 mb-3">This will archive your shop and hide it from the marketplace.</p>
              <div className="flex gap-2">
                <button onClick={onDelete} className="flex-1 bg-red-600 text-white text-sm font-semibold rounded-xl py-2 hover:bg-red-700 transition">Yes, Delete</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-sm font-semibold rounded-xl py-2 hover:bg-gray-200 transition">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
