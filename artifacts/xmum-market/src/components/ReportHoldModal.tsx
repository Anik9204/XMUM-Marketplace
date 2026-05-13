import { X, Lock, Mail, MessageCircle } from "lucide-react";

interface Props {
  action: "delete" | "edit";
  context?: "listing" | "account";
  onClose: () => void;
}

const ADMIN_EMAIL = "cys2209204@xmu.edu.my";
const ADMIN_WHATSAPP = "https://wa.me/60142246554";

export default function ReportHoldModal({ action, context = "listing", onClose }: Props) {
  const isAccount = context === "account";

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 w-full rounded-t-3xl sm:rounded-3xl sm:max-w-md shadow-2xl p-6 relative animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300">

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600 transition"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
          <Lock size={26} className="text-amber-600 dark:text-amber-400" />
        </div>

        <h2 className="font-display font-black text-xl text-gray-900 dark:text-slate-100 mb-2">
          {isAccount ? "Account deletion blocked" : "This listing is under review"}
        </h2>

        <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed mb-2">
          {isAccount
            ? "You cannot delete your account right now because you have one or more listings currently under admin review due to reports."
            : action === "delete"
              ? "You cannot delete this listing right now because it has been reported and is currently under admin review."
              : "You cannot edit this listing right now because it has been reported and is currently under admin review."
          }
        </p>
        <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed mb-5">
          {isAccount
            ? "Please wait for the reports to be resolved first, then you may delete your account."
            : `The listing has been hidden from public view. Once the report is resolved by an admin, you will be able to ${action === "delete" ? "delete" : "edit"} it again.`
          }
        </p>

        <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 mb-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Contact Admin for Review
          </p>
          <div className="flex flex-col gap-2">
            <a
              href={ADMIN_WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-[#25D366] text-white font-semibold text-sm rounded-xl px-4 py-3 min-h-[48px] hover:brightness-110 transition"
            >
              <MessageCircle size={18} />
              WhatsApp Admin
            </a>
            <a
              href={`mailto:${ADMIN_EMAIL}`}
              className="flex items-center gap-3 bg-[#003366] dark:bg-blue-600 text-white font-semibold text-sm rounded-xl px-4 py-3 min-h-[48px] hover:brightness-110 transition"
            >
              <Mail size={18} />
              Email Admin
            </a>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full min-h-[48px] rounded-xl border-2 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
