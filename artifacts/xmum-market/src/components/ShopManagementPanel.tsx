import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  getShopListings, createShopListing, updateShopListing, deleteShopListing,
  uploadShopListingPhoto, getInquiriesForShop, updateInquiryStatus, deleteInquiry,
  addShopEditor, removeShopEditor, updateShop, uploadShopBanner, uploadShopLogo,
  saveAutoReply,
  deleteShopCompletely, getShopVisitorCount30Days, getListingViews30Days,
} from "@/lib/shops";
import { getOrCreateConversation } from "@/lib/messaging";
import { collection, query, where, getDocs, limit, getDoc, doc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { notifyEditorAdded, notifyEditorRemoved } from "@/lib/notifications";
import {
  Shop, ShopListing, ShopInquiry, ShopCategory, InquiryStatus,
} from "@/lib/types";
import {
  Loader2, Plus, Trash2, Edit2, CheckCircle2, Package, MessageSquare, Users,
  Settings, ImagePlus, X, Store, UserMinus, UserPlus, Camera, Send,
  BarChart2,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

// ── Constants ──────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

const SHOP_CATEGORIES: ShopCategory[] = [
  "Food & Beverage", "Tutoring & Education", "Fashion & Apparel", "Electronics",
  "Beauty & Wellness", "Transport & Rental", "Handmade & Custom", "Books & Stationery",
  "Services", "Travel & Lifestyle", "Others",
];

const inputCls = "w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-h-[44px]";
const labelCls = "block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1";

type Tab = "listings" | "inquiries" | "analytics" | "settings";

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InquiryStatus }) {
  const map: Record<InquiryStatus, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    replied: { label: "Replied", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  };
  const { label, cls } = map[status] ?? map.pending;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

// ── ListingRow ─────────────────────────────────────────────────────────────────

function ListingRow({ listing, shopId, onRefresh, onEdit }: { listing: ShopListing; shopId: string; onRefresh: () => void; onEdit: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!confirm("Remove this listing? This cannot be undone.")) return;
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
        <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0"><Package size={20} className="text-gray-300 dark:text-slate-500" /></div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{listing.title}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{priceLabel}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500">{relativeTime(listing.createdAt)}</p>
      </div>
      <button onClick={onEdit} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="Edit"><Edit2 size={14} /></button>
      <button onClick={handleDelete} disabled={deleting} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition disabled:opacity-40" title="Remove">
        {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </button>
    </div>
  );
}

// ── AddListingForm ─────────────────────────────────────────────────────────────

function AddListingForm({ shopId, shop, onClose, onCreated }: { shopId: string; shop: Shop; onClose: () => void; onCreated: () => void }) {
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
        <div><label className={labelCls}>Title <span className="text-red-500">*</span></label><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Nasi Lemak Set" maxLength={80} /></div>
        <div><label className={labelCls}>Description</label><textarea className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>Price (RM)</label><input className={inputCls} type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" /></div>
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
                <img src={p} className="w-16 h-16 object-cover rounded-lg" alt="" />
                <button type="button" onClick={() => { setPhotos((a) => a.filter((_, j) => j !== i)); setPreviews((a) => a.filter((_, j) => j !== i)); }} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 text-white"><X size={10} /></button>
              </div>
            ))}
            {photos.length < 4 && (
              <button type="button" onClick={() => fileRef.current?.click()} className="w-16 h-16 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex items-center justify-center text-gray-400 hover:border-[#003366] hover:text-[#003366] transition"><ImagePlus size={18} /></button>
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

// ── EditShopListingForm ────────────────────────────────────────────────────────

function EditShopListingForm({ listing, shopId, shop, onCancel, onSaved }: { listing: ShopListing; shopId: string; shop: Shop; onCancel: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [price, setPrice] = useState(listing.price !== undefined ? String(listing.price) : "");
  const [pricingModel, setPricingModel] = useState<ShopListing["pricingModel"]>(listing.pricingModel ?? "fixed");
  const [category, setCategory] = useState<ShopCategory>(listing.category);
  const [isActive, setIsActive] = useState(listing.isActive);
  const [existingPhotos, setExistingPhotos] = useState<string[]>(listing.photos);
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);
  const [removedPhotoUrls, setRemovedPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const totalPhotos = existingPhotos.length + newPhotoFiles.length;

  function storagePathFromUrl(url: string): string | null {
    try { const match = decodeURIComponent(url).match(/\/o\/(.+?)(\?|$)/); return match ? match[1] : null; } catch { return null; }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setLoading(true); setError("");
    try {
      await Promise.allSettled(removedPhotoUrls.map((url) => { const path = storagePathFromUrl(url); return path ? deleteObject(ref(storage, path)).catch(() => {}) : Promise.resolve(); }));
      const newUrls: string[] = [];
      for (let i = 0; i < newPhotoFiles.length; i++) {
        const url = await uploadShopListingPhoto(shopId, newPhotoFiles[i], existingPhotos.length + i);
        newUrls.push(url);
      }
      await updateShopListing(listing.id, { title: title.trim(), description: description.trim(), price: price ? parseFloat(price) : undefined, pricingModel, category, isActive, photos: [...existingPhotos, ...newUrls] });
      onSaved();
    } catch (err: any) { setError(err.message ?? "Failed to save."); } finally { setLoading(false); }
  };

  return (
    <div className="bg-amber-50 dark:bg-slate-800/60 border border-amber-200 dark:border-slate-700 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Edit Listing</h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"><X size={16} /></button>
      </div>
      <form onSubmit={handleSave} className="space-y-3">
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div><label className={labelCls}>Title <span className="text-red-500">*</span></label><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} /></div>
        <div><label className={labelCls}>Description</label><textarea className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>Price (RM)</label><input className={inputCls} type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" /></div>
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
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-[#003366]" />
          Listing is active (visible to buyers)
        </label>
        <div>
          <label className={labelCls}>Photos (up to 4)</label>
          <div className="flex flex-wrap gap-2">
            {existingPhotos.map((url) => (
              <div key={url} className="relative w-16 h-16">
                <img src={url} className="w-16 h-16 object-cover rounded-lg" alt="" />
                <button type="button" onClick={() => { setExistingPhotos((p) => p.filter((u) => u !== url)); setRemovedPhotoUrls((p) => [...p, url]); }} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 text-white"><X size={10} /></button>
              </div>
            ))}
            {newPhotoPreviews.map((p, i) => (
              <div key={`new-${i}`} className="relative w-16 h-16">
                <img src={p} className="w-16 h-16 object-cover rounded-lg border-2 border-blue-300" alt="" />
                <button type="button" onClick={() => { setNewPhotoFiles((a) => a.filter((_, j) => j !== i)); setNewPhotoPreviews((a) => a.filter((_, j) => j !== i)); }} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 text-white"><X size={10} /></button>
              </div>
            ))}
            {totalPhotos < 4 && (
              <button type="button" onClick={() => fileRef.current?.click()} className="w-16 h-16 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex items-center justify-center text-gray-400 hover:border-[#003366] hover:text-[#003366] transition"><ImagePlus size={18} /></button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
              if (!e.target.files) return;
              const picked = Array.from(e.target.files).slice(0, 4 - totalPhotos);
              setNewPhotoFiles((p) => [...p, ...picked]);
              picked.forEach((f) => { const reader = new FileReader(); reader.onload = (ev) => setNewPhotoPreviews((p) => [...p, ev.target?.result as string]); reader.readAsDataURL(f); });
            }} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="flex-1 min-h-[44px] bg-[#003366] dark:bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-[#002244] disabled:opacity-50 transition flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : "Save Changes"}
          </button>
          <button type="button" onClick={onCancel} className="px-4 min-h-[44px] bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 font-semibold text-sm rounded-xl hover:bg-gray-200 transition">Cancel</button>
        </div>
      </form>
    </div>
  );
}

// ── ListingsTab ────────────────────────────────────────────────────────────────

function ListingsTab({ shopId, shop, listings, loading, showAdd, setShowAdd, onRefresh }: {
  shopId: string; shop: Shop; listings: ShopListing[]; loading: boolean;
  showAdd: boolean; setShowAdd: (v: boolean) => void; onRefresh: () => void;
}) {
  const [listingAdded, setListingAdded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">{listings.length} listing{listings.length !== 1 ? "s" : ""}</p>
        <div className="flex items-center gap-2">
          {listingAdded && <span className="text-xs text-green-600 dark:text-green-400 font-semibold animate-in fade-in">✅ Added!</span>}
          <button onClick={() => { setShowAdd(true); setEditingId(null); }} className="flex items-center gap-1.5 bg-[#003366] dark:bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#002244] transition">
            <Plus size={14} /> Add Listing
          </button>
        </div>
      </div>
      {showAdd && <AddListingForm shopId={shopId} shop={shop} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); setListingAdded(true); setTimeout(() => setListingAdded(false), 3000); onRefresh(); }} />}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-gray-400" /></div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500"><Package size={36} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No listings yet. Add your first one!</p></div>
      ) : (
        <div className="space-y-3">
          {listings.map((l) =>
            editingId === l.id ? (
              <EditShopListingForm key={l.id} listing={l} shopId={shopId} shop={shop} onCancel={() => setEditingId(null)} onSaved={() => { setEditingId(null); onRefresh(); }} />
            ) : (
              <ListingRow key={l.id} listing={l} shopId={shopId} onRefresh={onRefresh} onEdit={() => { setShowAdd(false); setEditingId(l.id); }} />
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── InquiriesTab ───────────────────────────────────────────────────────────────

function InquiriesTab({ inquiries, loading, onMarkReplied, onDelete, onChat }: {
  inquiries: ShopInquiry[]; loading: boolean;
  onMarkReplied: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onChat: (inq: ShopInquiry) => Promise<void>;
}) {
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const wrap = async (id: string, key: string, fn: () => Promise<void>) => {
    setActionLoading((prev) => ({ ...prev, [id]: key }));
    try { await fn(); } finally { setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; }); }
  };
  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-gray-400" /></div>;
  if (inquiries.length === 0) return <div className="text-center py-12 text-gray-400 dark:text-slate-500"><MessageSquare size={36} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No inquiries yet.</p></div>;
  return (
    <div className="space-y-3">
      {inquiries.map((inq) => {
        const busy = actionLoading[inq.id];
        return (
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
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => wrap(inq.id, "chat", () => onChat(inq))} disabled={!!busy} className="inline-flex items-center gap-1 text-xs text-white bg-[#003366] dark:bg-blue-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-[#002244] dark:hover:bg-blue-700 disabled:opacity-50 transition min-h-[32px]">
                {busy === "chat" ? <Loader2 size={11} className="animate-spin" /> : <MessageSquare size={11} />} Chat in App
              </button>
              {inq.buyerEmail && (
                <a href={`mailto:${inq.buyerEmail}?subject=${encodeURIComponent(`Re: ${inq.listingTitle}`)}&body=${encodeURIComponent(`Hi ${inq.buyerName},\n\nThank you for your inquiry about "${inq.listingTitle}". `)}`} className="inline-flex items-center gap-1 text-xs text-[#003366] dark:text-blue-400 font-semibold border border-[#003366]/30 dark:border-blue-500/40 px-3 py-1.5 rounded-lg hover:bg-[#003366]/5 transition min-h-[32px]">
                  <Send size={11} /> Email
                </a>
              )}
              {inq.status === "pending" && (
                <button onClick={() => wrap(inq.id, "reply", () => onMarkReplied(inq.id))} disabled={!!busy} className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 font-semibold border border-green-200 dark:border-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 transition min-h-[32px]">
                  {busy === "reply" ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Mark Replied
                </button>
              )}
              {deleteConfirm === inq.id ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => wrap(inq.id, "delete", async () => { await onDelete(inq.id); setDeleteConfirm(null); })} disabled={!!busy} className="text-xs text-white bg-red-500 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50 transition min-h-[32px] flex items-center gap-1">
                    {busy === "delete" ? <Loader2 size={11} className="animate-spin" /> : null} Confirm
                  </button>
                  <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-500 dark:text-slate-400 font-semibold px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition min-h-[32px]">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(inq.id)} disabled={!!busy} className="inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400 font-semibold border border-red-200 dark:border-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition min-h-[32px]">
                  <Trash2 size={11} /> Delete
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── AnalyticsTab ───────────────────────────────────────────────────────────────

function AnalyticsTab({ shopId, listings }: { shopId: string; listings: ShopListing[] }) {
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [listingViews, setListingViews] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getShopVisitorCount30Days(shopId),
      getListingViews30Days(shopId),
    ]).then(([visitors, views]) => {
      setVisitorCount(visitors);
      setListingViews(views);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [shopId]);

  const totalViews = listings.reduce((sum, l) => sum + (l.viewCount ?? 0), 0);
  const totalOrders = listings.reduce((sum, l) => sum + (l.inquiryCount ?? 0), 0);
  const topListings = [...listings]
    .filter((l) => (l.viewCount ?? 0) > 0)
    .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[#003366] dark:text-blue-400" />
      </div>
    );
  }

  const statCard = (label: string, value: string | number, sub?: string) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-sm">
      <p className="text-xs text-gray-400 dark:text-slate-500 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{value}</p>
      {sub && <p className="text-[10px] text-gray-300 dark:text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {statCard("Unique visits (30d)", visitorCount ?? 0, "listing page views")}
        {statCard("All-time views", totalViews, "across all listings")}
        {statCard("Total inquiries", totalOrders, "across all listings")}
        {statCard("Active listings", listings.filter((l) => l.isActive).length)}
      </div>

      {topListings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
            <BarChart2 size={14} className="text-[#003366] dark:text-blue-400" />
            Top listings by views
          </h3>
          <div className="space-y-2">
            {topListings.map((l, i) => {
              const pct = Math.round(((l.viewCount ?? 0) / (topListings[0].viewCount || 1)) * 100);
              return (
                <div key={l.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-4 py-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate">
                      <span className="text-gray-400 dark:text-slate-500 font-normal mr-1">#{i + 1}</span>
                      {l.title}
                    </p>
                    <span className="text-xs font-bold text-[#003366] dark:text-blue-400 shrink-0">
                      {l.viewCount ?? 0} views
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#003366] to-blue-400 h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {(listingViews[l.id] ?? 0) > 0 && (
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                      {listingViews[l.id]} visits in last 30 days
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {topListings.length === 0 && (
        <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
          <BarChart2 size={32} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
          <p className="text-sm text-gray-400 dark:text-slate-500">No view data yet.</p>
          <p className="text-xs text-gray-300 dark:text-slate-600 mt-0.5">Analytics appear once your listings get visits.</p>
        </div>
      )}
    </div>
  );
}

// ── EditorsTab ─────────────────────────────────────────────────────────────────

function EditorsTab({ shop, editorEmail, setEditorEmail, editorLoading, editorError, onAdd, onRemove }: {
  shop: Shop; editorEmail: string; setEditorEmail: (v: string) => void;
  editorLoading: boolean; editorError: string;
  onAdd: () => void; onRemove: (uid: string) => void;
}) {
  const [editorProfiles, setEditorProfiles] = useState<Record<string, { name: string; email: string }>>({});
  useEffect(() => {
    if (!shop.editorIds.length) return;
    Promise.all(shop.editorIds.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const data = snap.data();
          return [uid, { name: data.displayName || data.fullName || "Unknown", email: data.email || "" }] as const;
        }
      } catch {}
      return [uid, { name: "Unknown User", email: uid }] as const;
    })).then((results) => setEditorProfiles(Object.fromEntries(results)));
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
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">{editorProfiles[uid]?.name ?? "Loading..."}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{editorProfiles[uid]?.email ?? uid}</p>
              </div>
              <button onClick={() => onRemove(uid)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold transition"><UserMinus size={13} /> Remove</button>
            </div>
          ))}
        </div>
      )}
      {shop.editorIds.length < 3 && (
        <div className="bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <label className={labelCls}>Add Editor by Email</label>
          <div className="flex gap-2">
            <input className={`${inputCls} flex-1`} type="email" placeholder="student@xmu.edu.my" value={editorEmail} onChange={(e) => setEditorEmail(e.target.value)} />
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

// ── SettingsTab ────────────────────────────────────────────────────────────────

function SettingsTab({
  shop, isOwner, name, bio, category, whatsapp, wechat,
  setName, setBio, setCategory, setWhatsApp, setWeChat,
  loading, showDeleteConfirm, setShowDeleteConfirm,
  bannerInputRef, logoInputRef, editorContent, onSave, onBannerUpload, onLogoUpload, onDelete,
}: {
  shop: Shop; isOwner: boolean;
  name: string; bio: string; category: ShopCategory; whatsapp: string; wechat: string;
  setName: (v: string) => void; setBio: (v: string) => void; setCategory: (v: ShopCategory) => void;
  setWhatsApp: (v: string) => void; setWeChat: (v: string) => void;
  loading: boolean; showDeleteConfirm: boolean; setShowDeleteConfirm: (v: boolean) => void;
  bannerInputRef: React.RefObject<HTMLInputElement | null>; logoInputRef: React.RefObject<HTMLInputElement | null>;
  editorContent?: React.ReactNode;
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="h-28 relative" style={{ background: shop.bannerUrl ? undefined : "linear-gradient(135deg, #003366 0%, #0066cc 100%)" }}>
          {shop.bannerUrl && <img src={shop.bannerUrl} alt="" className="w-full h-full object-cover" />}
          <button onClick={() => !bannerUploading && bannerInputRef.current?.click()} disabled={bannerUploading} className="absolute top-2 right-2 bg-black/40 text-white p-1.5 rounded-lg hover:bg-black/60 transition disabled:opacity-60">
            {bannerUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          </button>
          <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            if (file.size > 5 * 1024 * 1024) { setUploadError("Banner must be under 5 MB."); return; }
            setUploadError(""); setBannerUploading(true);
            try { await onBannerUpload(file); } catch (err: any) { setUploadError("Upload failed: " + (err?.message ?? "Unknown error")); } finally { setBannerUploading(false); }
          }} />
        </div>
        <div className="px-4 pb-4 -mt-6 flex items-end gap-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-xl border-2 border-white dark:border-slate-800 bg-gray-100 dark:bg-slate-700 overflow-hidden">
              {shop.logoUrl ? <img src={shop.logoUrl} alt="" className="w-full h-full object-cover" /> : <Store size={28} className="text-gray-400 dark:text-slate-500 m-auto mt-3" />}
            </div>
            <button onClick={() => !logoUploading && logoInputRef.current?.click()} disabled={logoUploading} className="absolute -bottom-1 -right-1 bg-[#003366] text-white p-1 rounded-full hover:bg-[#002244] transition disabled:opacity-60">
              {logoUploading ? <Loader2 size={10} className="animate-spin" /> : <Camera size={10} />}
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              if (file.size > 5 * 1024 * 1024) { setUploadError("Logo must be under 5 MB."); return; }
              setUploadError(""); setLogoUploading(true);
              try { await onLogoUpload(file); } catch (err: any) { setUploadError("Upload failed: " + (err?.message ?? "Unknown error")); } finally { setLogoUploading(false); }
            }} />
          </div>
          <div className="pb-1"><p className="text-sm font-bold text-gray-900 dark:text-slate-100">{shop.name}</p><p className="text-xs text-gray-500 dark:text-slate-400">{shop.category}</p></div>
        </div>
        {uploadError && <p className="text-xs text-red-500 mt-2 px-4 pb-3">{uploadError}</p>}
      </div>
      <div><label className={labelCls}>Shop Name</label><input className={inputCls} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div>
        <label className={labelCls}>Category</label>
        <select className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-h-[44px]" value={category} onChange={(e) => setCategory(e.target.value as ShopCategory)}>
          {SHOP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Bio</label>
        <textarea className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none" rows={6} value={bio} onChange={(e) => { if (countWords(e.target.value) <= 500) setBio(e.target.value); }} placeholder="Describe your shop…" />
        <div className="flex justify-between mt-1"><p className="text-xs text-gray-400 dark:text-slate-500">Describe your shop's purpose, process, and details.</p><p className={`text-xs font-semibold tabular-nums ${countWords(bio) >= 480 ? "text-amber-500" : "text-gray-400 dark:text-slate-500"}`}>{countWords(bio)}/500 words</p></div>
      </div>
      <div><label className={labelCls}>WhatsApp</label><input className={inputCls} placeholder="+60123456789" value={whatsapp} onChange={(e) => setWhatsApp(e.target.value)} /></div>
      <div><label className={labelCls}>WeChat ID</label><input className={inputCls} placeholder="your_wechat_id" value={wechat} onChange={(e) => setWeChat(e.target.value)} /></div>
      <button onClick={handleSave} disabled={loading} className="w-full min-h-[48px] bg-[#003366] dark:bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-[#002244] disabled:opacity-50 transition flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : saved ? <><CheckCircle2 size={15} /> Saved!</> : "Save Changes"}
      </button>
      {editorContent && (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4 mt-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2"><Users size={14} /> Editors</h3>
          {editorContent}
        </div>
      )}
      {isOwner && (
        <div className="border-t border-red-100 dark:border-red-900/30 pt-4">
          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)} className="w-full text-sm text-red-500 border border-red-200 dark:border-red-800 rounded-xl py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition font-semibold">Delete Shop</button>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Are you sure?</p>
              <p className="text-xs text-red-600 dark:text-red-400 mb-3">This permanently deletes your shop, all listings, and inquiries. Cannot be undone.</p>
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

// ── Main ShopManagementPanel ───────────────────────────────────────────────────

export interface ShopManagementPanelProps {
  shopId: string;
  initialShop: Shop;
  isOwner: boolean;
  isEditor: boolean;
  onShopDeleted?: () => void;
  onShopUpdated?: (shop: Shop) => void;
}

export default function ShopManagementPanel({
  shopId, initialShop, isOwner, isEditor, onShopDeleted, onShopUpdated,
}: ShopManagementPanelProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [shop, setShop] = useState<Shop>(initialShop);
  const [tab, setTab] = useState<Tab>("listings");

  const [listings, setListings] = useState<ShopListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [showAddListing, setShowAddListing] = useState(false);

  const [inquiries, setInquiries] = useState<ShopInquiry[]>([]);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [pendingInquiryCount, setPendingInquiryCount] = useState(0);

  const [editorEmail, setEditorEmail] = useState("");
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState("");

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsName, setSettingsName] = useState(shop.name);
  const [settingsBio, setSettingsBio] = useState(shop.bio);
  const [settingsCategory, setSettingsCategory] = useState<ShopCategory>(shop.category);
  const [settingsWhatsApp, setSettingsWhatsApp] = useState(shop.whatsapp ?? "");
  const [settingsWeChat, setSettingsWeChat] = useState(shop.wechat ?? "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShop(initialShop);
    setSettingsName(initialShop.name);
    setSettingsBio(initialShop.bio);
    setSettingsCategory(initialShop.category);
    setSettingsWhatsApp(initialShop.whatsapp ?? "");
    setSettingsWeChat(initialShop.wechat ?? "");
  }, [initialShop.id]);

  useEffect(() => {
    (async () => {
      try {
        const inqs = await getInquiriesForShop(shopId);
        setPendingInquiryCount(inqs.filter((i) => i.status === "pending").length);
      } catch {}
    })();
  }, [shopId]);

  useEffect(() => {
    if (tab === "listings") {
      setLoadingListings(true);
      getShopListings(shopId).then(setListings).finally(() => setLoadingListings(false));
    }
    if (tab === "inquiries") {
      setLoadingInquiries(true);
      getInquiriesForShop(shopId).then(setInquiries).finally(() => setLoadingInquiries(false));
    }
  }, [tab, shopId]);

  const updateShopState = (updates: Partial<Shop>) => {
    setShop((prev) => {
      const updated = { ...prev, ...updates };
      onShopUpdated?.(updated);
      return updated;
    });
  };

  const TABS: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "listings",  label: "Listings",  icon: <Package size={15} /> },
    { key: "inquiries", label: "Inquiries", icon: <MessageSquare size={15} />, badge: pendingInquiryCount },
    { key: "analytics", label: "Analytics", icon: <BarChart2 size={15} /> },
    { key: "settings",  label: "Settings",  icon: <Settings size={15} /> },
  ];

  return (
    <div>
      <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1 mb-5 gap-1 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${tab === t.key ? "bg-white dark:bg-slate-700 shadow text-[#003366] dark:text-slate-100" : "text-gray-500 dark:text-slate-400"}`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            {t.badge ? <span className="ml-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">{t.badge}</span> : null}
          </button>
        ))}
      </div>

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
            getShopListings(shopId).then(setListings).finally(() => setLoadingListings(false));
          }}
        />
      )}

      {tab === "inquiries" && (
        <InquiriesTab
          inquiries={inquiries}
          loading={loadingInquiries}
          onMarkReplied={async (id) => {
            await updateInquiryStatus(id, "replied");
            setInquiries((prev) => prev.map((i) => i.id === id ? { ...i, status: "replied" as InquiryStatus } : i));
            setPendingInquiryCount((prev) => Math.max(0, prev - 1));
          }}
          onDelete={async (id) => {
            await deleteInquiry(id);
            setInquiries((prev) => prev.filter((i) => i.id !== id));
          }}
          onChat={async (inq) => {
            const convId = await getOrCreateConversation(
              user!.uid,
              inq.buyerId,
              { id: inq.shopListingId, title: inq.listingTitle, photos: [] },
              { shopName: shop.name, shopOwnerUid: shop.ownerId },
            );
            const greeting = `Hi ${inq.buyerName}, thank you for your inquiry about "${inq.listingTitle}"! `;
            navigate(`/messages?conv=${convId}&draft=${encodeURIComponent(greeting)}`);
          }}
        />
      )}

      {tab === "analytics" && (
        <AnalyticsTab
          shopId={shopId}
          listings={listings}
        />
      )}

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
          editorContent={isOwner ? (
            <EditorsTab
              shop={shop}
              editorEmail={editorEmail}
              setEditorEmail={setEditorEmail}
              editorLoading={editorLoading}
              editorError={editorError}
              onAdd={async () => {
                setEditorError(""); setEditorLoading(true);
                try {
                  const q = query(collection(db, "users"), where("email", "==", editorEmail.trim()), limit(1));
                  const snap = await getDocs(q);
                  if (snap.empty) { setEditorError("No XMUM user found with that email."); return; }
                  const uid = snap.docs[0].id;
                  await addShopEditor(shopId, uid, shop.editorIds);
                  updateShopState({ editorIds: [...shop.editorIds, uid] });
                  setEditorEmail("");
                  notifyEditorAdded(uid, shop.name, shopId).catch(() => {});
                } catch (err: any) {
                  setEditorError(err.message ?? "Failed to add editor.");
                } finally {
                  setEditorLoading(false);
                }
              }}
              onRemove={async (uid) => {
                await removeShopEditor(shopId, uid, shop.editorIds);
                updateShopState({ editorIds: shop.editorIds.filter((e) => e !== uid) });
                notifyEditorRemoved(uid, shop.name).catch(() => {});
              }}
            />
          ) : undefined}
          onSave={async () => {
            if (countWords(settingsBio) > 500) return;
            setSettingsLoading(true);
            try {
              await updateShop(shopId, { name: settingsName, bio: settingsBio, category: settingsCategory, whatsapp: settingsWhatsApp, wechat: settingsWeChat });
              updateShopState({ name: settingsName, bio: settingsBio, category: settingsCategory, whatsapp: settingsWhatsApp, wechat: settingsWeChat });
            } finally { setSettingsLoading(false); }
          }}
          onBannerUpload={async (file) => {
            const url = await uploadShopBanner(shopId, file);
            await updateShop(shopId, { bannerUrl: url });
            updateShopState({ bannerUrl: url });
          }}
          onLogoUpload={async (file) => {
            const url = await uploadShopLogo(shopId, file);
            await updateShop(shopId, { logoUrl: url });
            updateShopState({ logoUrl: url });
          }}
          onDelete={async () => {
            await deleteShopCompletely(shopId);
            onShopDeleted?.();
          }}
        />
      )}
    </div>
  );
}
