import { useEffect, useState } from "react";
import {
  collection, query, orderBy, onSnapshot,
  updateDoc, doc, deleteDoc, getDoc, increment,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage, writeAuditLog } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { AiFlag, AiFlagStatus } from "../lib/types";
import { Bot, ExternalLink, Trash2, CheckCircle, X } from "lucide-react";

const MAIN_APP_URL = import.meta.env.VITE_MAIN_APP_URL ?? "https://www.xmummarket.com";

function storagePathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const encoded = u.pathname.split("/o/")[1];
    if (!encoded) return null;
    return decodeURIComponent(encoded.split("?")[0]);
  } catch { return null; }
}

const CONTEXT_LABELS: Record<string, string> = {
  "listing":      "Regular Listing",
  "shop-listing": "Shop Listing",
  "shop-profile": "Shop Profile",
  "inquiry":      "Inquiry",
  "review":       "Review",
};

const CONTEXT_COLORS: Record<string, string> = {
  "listing":      "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  "shop-listing": "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  "shop-profile": "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  "inquiry":      "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
  "review":       "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300",
};

const STATUS_COLORS: Record<AiFlagStatus, string> = {
  pending:   "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  dismissed: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
  deleted:   "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
};

export default function AiFlaggedPage() {
  const { adminUser, isAdmin } = useAuth();
  const [flags, setFlags] = useState<AiFlag[]>([]);
  const [filter, setFilter] = useState<AiFlagStatus | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AiFlag | null>(null);

  useEffect(() => {
    const q = query(collection(db, "aiFlags"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setFlags(snap.docs.map(d => ({ id: d.id, ...d.data() } as AiFlag)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  async function dismissFlag(flag: AiFlag) {
    try {
      await updateDoc(doc(db, "aiFlags", flag.id), {
        status: "dismissed" as AiFlagStatus,
        reviewedBy: adminUser?.uid,
        reviewedAt: Date.now(),
      });
      void writeAuditLog({
        actorUid:    adminUser?.uid   ?? "",
        actorEmail:  adminUser?.email ?? "",
        action:      "ai_flag_dismissed",
        label:       `AI flag dismissed: "${flag.listingTitle ?? flag.shopName ?? flag.context}"`,
        targetId:    flag.id,
        targetType:  "report",
        targetLabel: flag.listingTitle ?? flag.shopName ?? flag.context,
        createdAt:   Date.now(),
      });
      if (selected?.id === flag.id) setSelected(prev => prev ? { ...prev, status: "dismissed" } : null);
    } catch (e) {
      alert("Failed to dismiss flag. Check the console.");
      console.error(e);
    }
  }

  async function deleteContent(flag: AiFlag) {
    if (!isAdmin) return;
    const label = flag.listingTitle ?? flag.shopName ?? flag.context;
    const confirmed = window.confirm(
      `This will permanently delete the flagged content "${label}" and mark this flag as deleted. Continue?`
    );
    if (!confirmed) return;
    try {
      if (flag.context === "listing" && flag.listingId) {
        const snap = await getDoc(doc(db, "listings", flag.listingId));
        if (snap.exists()) {
          const photos: string[] = snap.data().photos ?? [];
          await Promise.allSettled(
            photos.map(url => {
              const path = storagePathFromUrl(url);
              return path ? deleteObject(ref(storage, path)).catch(() => {}) : Promise.resolve();
            })
          );
          await deleteDoc(doc(db, "listings", flag.listingId));
        }
      } else if (flag.context === "shop-listing" && flag.listingId) {
        const listingSnap = await getDoc(doc(db, "shopListings", flag.listingId));
        const shopId = listingSnap.data()?.shopId;
        await deleteDoc(doc(db, "shopListings", flag.listingId));
        if (shopId) {
          updateDoc(doc(db, "shops", shopId), {
            totalListings: increment(-1),
          }).catch(() => {});
        }
      }
      await updateDoc(doc(db, "aiFlags", flag.id), {
        status: "deleted" as AiFlagStatus,
        reviewedBy: adminUser?.uid,
        reviewedAt: Date.now(),
      });
      void writeAuditLog({
        actorUid:    adminUser?.uid   ?? "",
        actorEmail:  adminUser?.email ?? "",
        action:      "ai_flag_content_deleted",
        label:       `AI flag content deleted: "${label}"`,
        targetId:    flag.id,
        targetType:  "report",
        targetLabel: label,
        createdAt:   Date.now(),
      });
      if (selected?.id === flag.id) setSelected(null);
    } catch (e) {
      alert("Failed to delete content. Check the console.");
      console.error(e);
    }
  }

  const filtered = filter === "all" ? flags : flags.filter(f => f.status === filter);
  const pendingCount = flags.filter(f => f.status === "pending").length;

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            AI Flagged
            {pendingCount > 0 && (
              <span className="text-xs bg-red-500 text-white font-bold rounded-full px-2 py-0.5">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Content flagged by Gemini AI for admin review. Flagged content is still live — review and decide to keep or delete.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {(["all", "pending", "dismissed", "deleted"] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium min-h-[40px] transition-colors capitalize
                              ${filter === s
                                ? "bg-blue-600 text-white"
                                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700"}`}>
            {s}
            {s !== "all" && (
              <span className="ml-1.5 text-[10px] opacity-70">
                ({flags.filter(f => f.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl h-28 animate-pulse border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Bot className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            No {filter !== "all" ? filter : ""} AI flags
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {filter === "pending" ? "Nothing needs review right now." : "Nothing here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(flag => (
            <div key={flag.id}
                 onClick={() => setSelected(flag)}
                 className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 cursor-pointer hover:border-purple-200 dark:hover:border-purple-700 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_COLORS[flag.status]}`}>
                      {flag.status}
                    </span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${CONTEXT_COLORS[flag.context] ?? ""}`}>
                      {CONTEXT_LABELS[flag.context] ?? flag.context}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {flag.listingTitle ?? flag.shopName ?? `[${flag.context}]`}
                  </p>
                  {flag.userEmail && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      By: {flag.userEmail}
                    </p>
                  )}
                  <div className="mt-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-semibold text-purple-500 dark:text-purple-400 uppercase tracking-wide mb-0.5">
                      🤖 AI Reason
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                      {flag.reason || "No reason provided."}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {new Date(flag.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {flag.context === "listing" && flag.listingId && (
                    <a href={`${MAIN_APP_URL}/listing/${flag.listingId}`}
                       target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 min-h-[36px]">
                      <ExternalLink className="w-3 h-3" /> View Listing
                    </a>
                  )}
                  {(flag.context === "shop-listing" || flag.context === "shop-profile") && flag.shopSlug && (
                    <a href={`${MAIN_APP_URL}/shop/${flag.shopSlug}`}
                       target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 min-h-[36px]">
                      <ExternalLink className="w-3 h-3" /> View Shop
                    </a>
                  )}

                  {flag.status === "pending" && (
                    <>
                      <button onClick={() => dismissFlag(flag)}
                              className="flex items-center gap-1.5 text-xs text-green-600 border border-green-200 rounded-xl px-3 py-2 hover:bg-green-50 dark:hover:bg-green-900/20 min-h-[36px]">
                        <CheckCircle className="w-3 h-3" /> Keep
                      </button>
                      {isAdmin && (
                        <button onClick={() => deleteContent(flag)}
                                className="flex items-center gap-1.5 text-xs text-red-500 border border-red-200 rounded-xl px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 min-h-[36px]">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
             onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">AI Flag Detail</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_COLORS[selected.status]}`}>
                  {selected.status}
                </span>
              </div>
              <button onClick={() => setSelected(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 min-h-[44px] flex items-center justify-center w-8">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Context</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CONTEXT_COLORS[selected.context] ?? ""}`}>
                    {CONTEXT_LABELS[selected.context] ?? selected.context}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Flagged At</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {new Date(selected.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {(selected.listingTitle || selected.shopName) && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                    {selected.listingTitle ? "Listing" : "Shop"}
                  </p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {selected.listingTitle ?? selected.shopName}
                  </p>
                </div>
              )}

              {selected.userEmail && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Posted By</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 break-all">{selected.userEmail}</p>
                </div>
              )}

              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">🤖 AI Reason</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50 rounded-xl px-4 py-3 leading-relaxed">
                  {selected.reason || "No reason provided."}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Flagged Content</p>
                <pre className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded-xl px-4 py-3 leading-relaxed whitespace-pre-wrap break-words font-sans">
                  {selected.content}
                </pre>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                {selected.context === "listing" && selected.listingId && (
                  <a href={`${MAIN_APP_URL}/listing/${selected.listingId}`}
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center justify-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 min-h-[44px] transition-colors">
                    <ExternalLink className="w-4 h-4" /> View Listing in Marketplace
                  </a>
                )}
                {(selected.context === "shop-listing" || selected.context === "shop-profile") && selected.shopSlug && (
                  <a href={`${MAIN_APP_URL}/shop/${selected.shopSlug}`}
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center justify-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 min-h-[44px] transition-colors">
                    <ExternalLink className="w-4 h-4" /> View Shop in Marketplace
                  </a>
                )}

                {selected.status === "pending" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => dismissFlag(selected)}
                            className="flex items-center justify-center gap-1.5 text-sm text-green-600 border border-green-200 rounded-xl px-4 py-2.5 hover:bg-green-50 dark:hover:bg-green-900/20 min-h-[44px]">
                      <CheckCircle className="w-4 h-4" /> Keep Content
                    </button>
                    {isAdmin && (
                      <button onClick={() => deleteContent(selected)}
                              className="flex items-center justify-center gap-1.5 text-sm text-red-500 border border-red-200 rounded-xl px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 min-h-[44px]">
                        <Trash2 className="w-4 h-4" /> Delete Content
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
