import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  addDoc,
} from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { AdminUser } from "../lib/types";
import { CheckCircle2, XCircle, ExternalLink, Loader2, Image as ImageIcon } from "lucide-react";

function Toast({ message, type, onDone }: { message: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in ${type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
      {type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      {message}
    </div>
  );
}

function IdPhotoButton({ uid, side }: { uid: string; side: "front" | "back" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleOpen = async () => {
    setLoading(true);
    setError(false);
    try {
      const path = `studentIds/${uid}/${side}.jpg`;
      const url = await getDownloadURL(ref(storage, path)).catch(async () => {
        return getDownloadURL(ref(storage, `studentIds/${uid}/${side}.png`));
      });
      window.open(url, "_blank");
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleOpen}
      disabled={loading}
      className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border text-xs font-medium transition-colors min-w-[90px] ${
        error
          ? "border-red-200 text-red-500 bg-red-50 dark:bg-red-900/20"
          : "border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
      }`}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin text-gray-400" />
      ) : (
        <ImageIcon size={18} className="text-gray-400" />
      )}
      {error ? "Not found" : `${side === "front" ? "Front" : "Back"} ID`}
      {!error && !loading && <ExternalLink size={10} className="text-gray-300" />}
    </button>
  );
}

interface RejectModalProps {
  user: AdminUser;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

function RejectModal({ user, onConfirm, onCancel }: RejectModalProps) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-1">Reject Verification</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          Rejecting <span className="font-medium">{user.email}</span>. Please provide a reason.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 200))}
          placeholder="e.g. ID photo is blurry, not a valid XMUM student ID, etc."
          className="w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-slate-100 resize-none h-24 focus:outline-none focus:ring-2 focus:ring-red-400 mb-1"
        />
        <p className="text-xs text-right text-gray-400 mb-4">{reason.length} / 200</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 min-h-[44px] border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="flex-1 min-h-[44px] bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerificationPage() {
  const { isAdmin } = useAuth();
  const [requests, setRequests] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminUser | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "users"),
      where("verificationStatus", "==", "pending"),
      orderBy("verificationSubmittedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRequests(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AdminUser)));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const handleApprove = async (u: AdminUser) => {
    if (!isAdmin) return;
    setProcessing(u.uid);
    try {
      await updateDoc(doc(db, "users", u.uid), {
        verificationStatus: "approved",
        isVerified: true,
        verificationReviewedAt: Date.now(),
      });
      await addDoc(collection(db, "users", u.uid, "notifications"), {
        type: "welcome",
        title: "Shop approved! 🎉",
        body: `Your shop "${u.shopName || "your shop"}" is now live. You can post all listing types.`,
        createdAt: Date.now(),
        read: false,
      });
      setToast({ message: `Approved ${u.email}`, type: "success" });
    } catch {
      setToast({ message: "Failed to approve. Try again.", type: "error" });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (u: AdminUser, reason: string) => {
    setRejectTarget(null);
    setProcessing(u.uid);
    try {
      await updateDoc(doc(db, "users", u.uid), {
        verificationStatus: "rejected",
        verificationRejectionReason: reason,
        verificationReviewedAt: Date.now(),
      });
      await addDoc(collection(db, "users", u.uid, "notifications"), {
        type: "welcome",
        title: "Shop verification rejected",
        body: `Reason: ${reason}. You can reapply from Settings.`,
        createdAt: Date.now(),
        read: false,
      });
      setToast({ message: `Rejected ${u.email}`, type: "success" });
    } catch {
      setToast({ message: "Failed to reject. Try again.", type: "error" });
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (ts?: number) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("en-MY", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="p-6">
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
      {rejectTarget && (
        <RejectModal
          user={rejectTarget}
          onConfirm={(reason) => handleReject(rejectTarget, reason)}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      <div className="mb-5 flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">Shop Verification Requests</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Review student ID uploads and approve or reject shop applications.
          </p>
        </div>
        {requests.length > 0 && (
          <span className="ml-auto inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-amber-500 text-white text-xs font-bold">
            {requests.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 bg-white dark:bg-slate-800 rounded-2xl animate-pulse border border-gray-100 dark:border-slate-700" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <CheckCircle2 size={48} className="text-green-400 mb-3" />
          <p className="text-base font-semibold text-slate-600 dark:text-slate-300">No pending verifications</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((u) => (
            <div key={u.uid} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex flex-wrap items-start gap-4">
                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{u.displayName || u.fullName || "—"}</span>
                    <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">Pending</span>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{u.email}</p>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-3">
                    <div>
                      <span className="text-slate-400">Shop Name</span>
                      <p className="font-medium text-slate-700 dark:text-slate-300">{u.shopName || "—"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Submitted</span>
                      <p className="font-medium text-slate-700 dark:text-slate-300">{formatDate(u.verificationSubmittedAt)}</p>
                    </div>
                    {u.shopBio && (
                      <div className="col-span-2">
                        <span className="text-slate-400">Bio</span>
                        <p className="font-medium text-slate-700 dark:text-slate-300 line-clamp-2">{u.shopBio}</p>
                      </div>
                    )}
                    {u.shopCategories && u.shopCategories.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-slate-400">Categories</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {u.shopCategories.map((c) => (
                            <span key={c} className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ID photo buttons */}
                  <div className="flex gap-2 mb-3">
                    <IdPhotoButton uid={u.uid} side="front" />
                    <IdPhotoButton uid={u.uid} side="back" />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(u)}
                    disabled={processing === u.uid}
                    className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors"
                  >
                    {processing === u.uid ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectTarget(u)}
                    disabled={processing === u.uid}
                    className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                  <a
                    href={`https://${window.location.hostname.replace("3002", "5000")}/seller/${u.uid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-center justify-center"
                  >
                    <ExternalLink size={14} />
                    Profile
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
