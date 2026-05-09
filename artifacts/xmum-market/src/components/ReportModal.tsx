import { useState, useEffect } from "react";
import { X, Flag, Loader2, CheckCircle2 } from "lucide-react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Listing, ReportCategory } from "../lib/types";
import { useToast } from "../hooks/use-toast";

interface Props {
  listing: Listing;
  onClose: () => void;
}

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: "spam",            label: "Spam or misleading" },
  { value: "scam",            label: "Scam or fraud" },
  { value: "offensive",       label: "Offensive content" },
  { value: "prohibited_item", label: "Prohibited item" },
  { value: "wrong_category",  label: "Wrong category" },
  { value: "other",           label: "Other" },
];

export default function ReportModal({ listing, onClose }: Props) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [category, setCategory] = useState<ReportCategory>("other");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => onClose(), 2500);
      return () => clearTimeout(timer);
    }
  }, [submitted, onClose]);

  async function handleSubmit() {
    if (!user || !userProfile) return;
    if (reason.trim().length < 10) {
      toast({ title: "Please provide more detail (at least 10 characters)", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await Promise.race([
        addDoc(collection(db, "reports"), {
          listingId:        listing.id,
          listingTitle:     listing.title,
          listingUserId:    listing.userId,
          listingUserEmail: listing.userEmail,
          reportedBy:       user.uid,
          reportedByEmail:  user.email,
          reason:           reason.trim().slice(0, 500),
          category,
          status:           "pending",
          createdAt:        Date.now(),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout:submit-report")), 6000)
        ),
      ]);
      setSubmitted(true);
    } catch (err) {
      toast({ title: "Failed to submit report. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-800 w-full rounded-t-2xl sm:rounded-2xl sm:max-w-[440px] shadow-modal max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300">
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Report Listing
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {submitted ? (
            <div className="flex flex-col items-center py-10 px-5 text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-9 h-9 text-green-500 dark:text-green-400" />
              </div>
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-base">
                Thank you for your report
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xs">
                Our team will review it shortly.
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-2">
                  Reason for report
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setCategory(c.value)}
                      className={`text-xs text-left px-3 py-2.5 rounded-xl border min-h-[44px] transition-colors ${
                        category === c.value
                          ? "border-red-400 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                          : "border-gray-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-2">
                  Additional details
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="Describe why you're reporting this listing…"
                  className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none text-slate-800 dark:text-slate-200"
                />
                <p className="text-right text-[10px] text-slate-400 mt-0.5">
                  {reason.length}/500
                </p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || reason.trim().length < 10}
                className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl min-h-[52px] flex items-center justify-center gap-2 text-sm transition-colors"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                  : "Submit Report"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
