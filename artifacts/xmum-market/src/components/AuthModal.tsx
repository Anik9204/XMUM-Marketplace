import { useState, useEffect, useRef } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { signIn, signUp, resetPassword, isXmuEmail, resendVerification } from "@/lib/auth";
import { X, Eye, EyeOff, MailCheck } from "lucide-react";

type Mode = "signin" | "signup" | "forgot";

interface Props {
  onClose: () => void;
  defaultMode?: Mode;
}

const RESEND_COOLDOWN = 60;

export default function AuthModal({ onClose, defaultMode = "signin" }: Props) {
  const { t } = useLang();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [wechat, setWechat] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Verification pending state
  const [verificationPending, setVerificationPending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  // Auto-close the modal the instant the context detects email verification.
  // Gated on verificationPending so this never fires during a normal sign-in.
  useEffect(() => {
    if (verificationPending && user?.emailVerified) {
      onClose();
    }
  }, [user?.emailVerified, verificationPending]);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    setResending(true);
    setResendMsg("");
    try {
      await resendVerification();
      setResendMsg(t.emailSent);
      startCooldown();
    } catch {
      setResendMsg(t.errorOccurred);
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === "forgot") {
        await resetPassword(email);
        setSuccess(t.emailSent);
      } else if (mode === "signup") {
        if (!isXmuEmail(email)) { setError(t.onlyXmuEmail); return; }
        if (!fullName.trim()) { setError("Full name is required."); return; }
        if (password.length < 6) { setError(t.weakPassword); return; }
        if (password !== confirmPass) { setError(t.passwordsNoMatch); return; }
        await signUp(email, password, fullName.trim(), whatsapp.trim(), wechat.trim());
        setPendingEmail(email);
        setVerificationPending(true);
        startCooldown();
      } else {
        await signIn(email, password);
        onClose();
      }
    } catch (err: any) {
      const code = err?.code ?? err?.message ?? "";
      if (code === "only_xmu_email" || code.includes("only_xmu")) setError(t.onlyXmuEmail);
      else if (code.includes("wrong-password") || code.includes("invalid-credential")) setError("Invalid email or password.");
      else if (code.includes("user-not-found")) setError("No account found with this email.");
      else if (code.includes("email-already-in-use")) setError("An account already exists with this email. Please sign in.");
      else setError(t.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  // ── Verification Pending View ────────────────────────────────────────────────
  if (verificationPending) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#003366] to-[#0055aa]" />

          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>

          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MailCheck size={32} className="text-[#003366]" />
            </div>

            <h2 className="text-lg font-bold text-gray-900 mb-1">Check your inbox</h2>
            <p className="text-sm text-gray-500 mb-1">
              A verification link was sent to:
            </p>
            <p className="text-sm font-semibold text-[#003366] mb-4 break-all">{pendingEmail}</p>

            <div className="bg-blue-50 rounded-xl p-3 text-left mb-5">
              <p className="text-xs text-blue-800 leading-relaxed">
                Click the link in the email to verify your <strong>@xmu.edu.my</strong> address. Once verified, the app will update automatically — no need to sign in again.
              </p>
            </div>

            {resendMsg && (
              <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-3">{resendMsg}</p>
            )}

            <button
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              className="w-full border border-[#003366] text-[#003366] rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-3"
            >
              {resending
                ? "Sending..."
                : cooldown > 0
                ? `${t.resendVerification} (${cooldown}s)`
                : t.resendVerification}
            </button>

            <button
              onClick={onClose}
              className="w-full bg-[#003366] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#002244] transition-colors"
            >
              Continue Browsing →
            </button>

            <p className="text-[10px] text-gray-400 mt-3">
              You're already signed in. The app will detect verification automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Normal Auth View ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="h-1.5 bg-gradient-to-r from-[#003366] to-[#0055aa]" />

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
          <X size={20} />
        </button>

        <div className="p-6">
          <div className="text-center mb-5">
            <h2 className="text-xl font-bold text-[#003366]">{t.appName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {mode === "forgot" ? t.resetPassword : mode === "signup" ? t.createAccount : t.welcomeBack}
            </p>
          </div>

          {mode !== "forgot" && (
            <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
              <button
                onClick={() => { setMode("signin"); setError(""); setSuccess(""); }}
                className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-all ${mode === "signin" ? "bg-white shadow text-[#003366]" : "text-gray-500"}`}
              >
                {t.signIn}
              </button>
              <button
                onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
                className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-all ${mode === "signup" ? "bg-white shadow text-[#003366]" : "text-gray-500"}`}
              >
                {t.signUp}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Full Name — signup only, required */}
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ahmad bin Razak"
                  required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366] transition"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@xmu.edu.my"
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366] transition"
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t.password}</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366] transition"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-2.5 text-gray-400">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t.confirmPassword}</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366] transition"
                />
              </div>
            )}

            {/* Optional contact fields — signup only */}
            {mode === "signup" && (
              <div className="border-t border-gray-100 pt-3 space-y-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Contact Info <span className="font-normal normal-case">(optional — can be set later)</span>
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t.whatsapp}</label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+60 12-345 6789"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t.wechat}</label>
                  <input
                    type="text"
                    value={wechat}
                    onChange={(e) => setWechat(e.target.value)}
                    placeholder="WeChat ID"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366] transition"
                  />
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#003366] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#002244] disabled:opacity-50 transition-colors mt-1"
            >
              {loading
                ? t.loading
                : mode === "forgot"
                ? t.sendResetEmail
                : mode === "signup"
                ? t.createAccount
                : t.signIn}
            </button>
          </form>

          {mode === "signin" && (
            <button
              onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
              className="w-full text-center text-xs text-[#003366] hover:underline mt-3"
            >
              {t.forgotPassword}
            </button>
          )}

          {mode === "forgot" && (
            <button
              onClick={() => { setMode("signin"); setError(""); setSuccess(""); }}
              className="w-full text-center text-xs text-[#003366] hover:underline mt-3"
            >
              {t.backToSignIn}
            </button>
          )}

          {mode === "signup" && (
            <p className="text-center text-[10px] text-gray-400 mt-3">
              Only <span className="font-semibold text-[#003366]">@xmu.edu.my</span> emails are accepted.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
