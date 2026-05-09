import { useState, useEffect } from "react";
import { ShieldAlert } from "lucide-react";

interface Props {
  onAccept: () => void;
  onCancel: () => void;
}

export default function RentalTcModal({ onAccept, onCancel }: Props) {
  const [checked, setChecked] = useState(false);

  // Block Escape key — modal is non-dismissible
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.preventDefault();
    };
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, []);

  return (
    // Backdrop — click is intentionally not forwarded to onCancel
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="m-auto w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden mx-4">
        {/* Header — non-scrollable */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-950 shrink-0 rounded-t-2xl">
          <ShieldAlert size={22} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Rental Platform Disclaimer — Please Read
            </h2>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              You must read and agree before posting a rental listing.
            </p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
          <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
            <p className="font-semibold text-red-800 dark:text-red-300 text-xs uppercase tracking-wide mb-1">
              Important Notice
            </p>
            <p className="text-red-700 dark:text-red-400 text-sm">
              XMUM Marketplace is a <strong>peer-to-peer platform</strong> and is{" "}
              <strong>NOT responsible</strong> for any vehicle rental transactions, disputes,
              damages, accidents, or losses arising from rentals arranged through this platform.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
              1. Responsibility of Both Parties
            </p>
            <p>
              Both the vehicle owner (poster) and the renter are <strong>solely responsible</strong>{" "}
              for verifying:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
              <li>The other party's valid Malaysian driving licence</li>
              <li>Current and valid vehicle insurance coverage</li>
              <li>Roadworthiness of the vehicle (PUSPAKOM or equivalent)</li>
              <li>Full compliance with Malaysian Road Transport Act 1987 and all applicable traffic laws</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
              2. Permanent Record Retention
            </p>
            <p>
              XMUM Marketplace retains a <strong>permanent, tamper-proof record</strong> of your
              acceptance of this disclaimer, including your user ID, timestamp, and device
              information. This record is <strong>not deleted</strong> even if you delete your
              listing, deactivate your account, or request data removal, as it may be required
              for legal compliance purposes.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
              3. Dispute Resolution
            </p>
            <p>
              Any dispute, loss, or damage arising from a rental arranged through this platform is{" "}
              <strong>strictly between the two parties involved</strong>. XMUM Marketplace will not
              mediate, arbitrate, or assume liability for any such disputes. Users are encouraged to
              document all rental agreements in writing before proceeding.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
              4. Data Collection for Legal Compliance
            </p>
            <p>
              By posting or renting a vehicle through this platform, you expressly consent to XMUM
              Marketplace retaining your <strong>acceptance timestamp</strong>, user ID, and device
              information (user agent) for legal compliance purposes under the Personal Data
              Protection Act 2010 (PDPA) of Malaysia.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
              5. Prohibited Conduct & Enforcement
            </p>
            <p>
              Posting vehicles without proper ownership documentation, providing false vehicle
              information, listing unlicensed or unroadworthy vehicles, or engaging in any
              fraudulent rental activity may result in:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
              <li>Immediate and permanent suspension of your XMUM Marketplace account</li>
              <li>Reporting of your details to the relevant Malaysian authorities</li>
              <li>Legal action under applicable Malaysian law</li>
            </ul>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-xs text-blue-700 dark:text-blue-400">
            This disclaimer is governed by the laws of Malaysia. Version: rental-tc-v1.
          </div>
        </div>

        {/* Footer — mandatory checkbox + buttons */}
        <div className="shrink-0 border-t border-gray-200 dark:border-slate-700 px-5 py-4 space-y-3 bg-gray-50 dark:bg-slate-800/50 rounded-b-2xl">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
            />
            <span className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed">
              I have read and agree to the Rental Platform Disclaimer. I understand that{" "}
              <strong>XMUM Marketplace is not responsible</strong> for rental transactions, and
              I consent to the retention of my acceptance record for legal compliance purposes.
            </span>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 min-h-[44px] border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={!checked}
              className="flex-1 min-h-[44px] bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
            >
              I Agree &amp; Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
