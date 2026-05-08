import { useState } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { resendVerification } from "@/lib/auth";
import { MailOpen, X } from "lucide-react";

export default function VerificationBanner() {
  const { t } = useLang();
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleResend = async () => {
    await resendVerification();
    setSent(true);
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center gap-3">
      <MailOpen size={16} className="text-amber-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-amber-800 dark:text-amber-300">
          {sent ? t.emailSent : t.verifyEmailMsg}
        </p>
        {!sent && (
          <button onClick={handleResend} className="text-xs text-amber-700 dark:text-amber-400 underline mt-0.5">
            {t.resendVerification}
          </button>
        )}
      </div>
      <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}
