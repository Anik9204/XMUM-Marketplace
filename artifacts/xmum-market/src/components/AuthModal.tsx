import { useState, useEffect, useRef } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { signIn, signUp, resetPasswordWithCheck, isXmuEmail, resendVerification } from "@/lib/auth";
import { X, Eye, EyeOff, MailCheck } from "lucide-react";

type Mode = "signin" | "signup" | "forgot";

function getPasswordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (pw.length === 0) return { level: 0, label: "" };
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  const longEnough = pw.length >= 8;
  if (!longEnough || !hasLetter) return { level: 1, label: "Weak" };
  if (longEnough && hasLetter && hasNumber && !hasSpecial) return { level: 2, label: "Fair" };
  if (longEnough && hasLetter && hasNumber && hasSpecial) return { level: 3, label: "Strong" };
  return { level: 1, label: "Weak" };
}

interface Props {
  onClose: () => void;
  defaultMode?: Mode;
}

const RESEND_COOLDOWN = 60;

const inputCls =
  "w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm min-h-[44px] dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition";

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

  const [verificationPending, setVerificationPending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const [forgotCooldown, setForgotCooldown] = useState(0);
  const forgotTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Clean up both timers on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(forgotTimerRef.current);
    };
  }, []);

  // Reset forgot cooldown whenever the mode changes
  useEffect(() => {
    setForgotCooldown(0);
    clearInterval(forgotTimerRef.current);
  }, [mode]);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (verificationPending && user?.emailVerified) {
      onClose();
    }
  }, [user?.emailVerified, verificationPending]);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
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
        await resetPasswordWithCheck(email);
        setSuccess(t.emailSent);
        setForgotCooldown(60);
        forgotTimerRef.current = setInterval(() => {
          setForgotCooldown((prev) => {
            if (prev <= 1) { clearInterval(forgotTimerRef.current); return 0; }
            return prev - 1;
          });
        }, 1000);
      } else if (mode === "signup") {
        if (!isXmuEmail(email)) { setError(t.onlyXmuEmail); return; }
        if (!fullName.trim()) { setError("Full name is required."); return; }
        if (password.length < 8) { setError(t.passwordTooShort); return; }
        if (password.length > 32) { setError(t.passwordTooLong); return; }
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) { setError(t.passwordTooWeak); return; }
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
      if (mode === "forgot" && (code === "auth/user-not-found" || code.includes("user-not-found"))) {
        setError(t.emailNotRegistered);
      } else if (code === "only_xmu_email" || code.includes("only_xmu")) setError(t.onlyXmuEmail);
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
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md sm:mx-4 relative max-h-[90dvh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] sm:pb-0">
          <div className="h-1.5 bg-gradient-to-r from-[#003366] to-[#0055aa]" />
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
            <X size={20} />
          </button>
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <MailCheck size={32} className="text-[#003366] dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">Check your inbox</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">A verification link was sent to:</p>
            <p className="text-sm font-semibold text-[#003366] dark:text-blue-400 mb-4 break-all">{pendingEmail}</p>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-left mb-5">
              <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                Click the link in the email to verify your <strong>@xmu.edu.my</strong> address. Once verified, the app will update automatically.
              </p>
            </div>
            {resendMsg && (
              <p className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2 mb-3">{resendMsg}</p>
            )}
            <button
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              className="w-full min-h-[44px] border border-[#003366] dark:border-blue-500 text-[#003366] dark:text-blue-400 rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-3"
            >
              {resending ? "Sending..." : cooldown > 0 ? `${t.resendVerification} (${cooldown}s)` : t.resendVerification}
            </button>
            <button
              onClick={onClose}
              className="w-full min-h-[44px] bg-[#003366] dark:bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#002244] dark:hover:bg-blue-700 transition-colors"
            >
              Continue Browsing →
            </button>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-3">
              You're already signed in. The app will detect verification automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Normal Auth View ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md sm:mx-4 relative max-h-[90dvh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] sm:pb-0">
        <div className="h-1.5 bg-gradient-to-r from-[#003366] to-[#0055aa]" />
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 z-10">
          <X size={20} />
        </button>

        <div className="p-6">
          <div className="text-center mb-5">
            <h2 className="text-xl font-bold text-[#003366] dark:text-slate-100">{t.appName}</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {mode === "forgot" ? t.resetPassword : mode === "signup" ? t.createAccount : t.welcomeBack}
            </p>
          </div>

          {mode !== "forgot" && (
            <div className="flex bg-gray-100 dark:bg-slate-700 rounded-xl p-1 mb-5">
              <button
                onClick={() => { setMode("signin"); setError(""); setSuccess(""); }}
                className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-all ${mode === "signin" ? "bg-white dark:bg-slate-600 shadow text-[#003366] dark:text-slate-100" : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-600/50"}`}
              >
                {t.signIn}
              </button>
              <button
                onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
                className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-all ${mode === "signup" ? "bg-white dark:bg-slate-600 shadow text-[#003366] dark:text-slate-100" : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-600/50"}`}
              >
                {t.signUp}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ahmad bin Razak"
                  required
                  className={inputCls}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">{t.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@xmu.edu.my"
                required
                className={inputCls}
              />
              {mode === "signup" && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <span>⚠️</span>
                  Only <strong>@xmu.edu.my</strong> emails are accepted
                </p>
              )}
            </div>

            {mode !== "forgot" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">{t.password}</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    maxLength={mode === "signup" ? 32 : undefined}
                    className={`${inputCls} pr-10`}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {mode === "signup" && password.length > 0 && (() => {
                  const { level, label } = getPasswordStrength(password);
                  const colors = ["", "bg-red-400", "bg-yellow-400", "bg-green-500"];
                  const widths = ["", "w-1/3", "w-2/3", "w-full"];
                  return (
                    <div className="mt-1.5">
                      <div className="h-1 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${colors[level]} ${widths[level]}`} />
                      </div>
                      <p className={`text-[10px] mt-0.5 ${level === 1 ? "text-red-500" : level === 2 ? "text-yellow-500" : "text-green-600"}`}>
                        {label}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">{t.confirmPassword}</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  required
                  maxLength={32}
                  className={inputCls}
                />
              </div>
            )}

            {mode === "signup" && (
              <div className="border-t border-gray-100 dark:border-slate-700 pt-3 space-y-3">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                  Contact Info <span className="font-normal normal-case">(optional — can be set later)</span>
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">{t.whatsapp}</label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+60 12-345 6789"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">{t.wechat}</label>
                  <input
                    type="text"
                    value={wechat}
                    onChange={(e) => setWechat(e.target.value)}
                    placeholder="WeChat ID"
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">{success}</p>}

            <button
              type="submit"
              disabled={loading || (mode === "forgot" && forgotCooldown > 0)}
              className="w-full min-h-[44px] bg-[#003366] dark:bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#002244] dark:hover:bg-blue-700 disabled:opacity-50 transition-colors mt-1"
            >
              {loading
                ? t.loading
                : mode === "forgot" && forgotCooldown > 0
                ? `${t.resendIn} ${forgotCooldown}s`
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
              className="w-full text-center text-xs text-[#003366] dark:text-blue-400 hover:underline mt-3"
            >
              {t.forgotPassword}
            </button>
          )}
          {mode === "forgot" && (
            <button
              onClick={() => { setMode("signin"); setError(""); setSuccess(""); }}
              className="w-full text-center text-xs text-[#003366] dark:text-blue-400 hover:underline mt-3"
            >
              {t.backToSignIn}
            </button>
          )}
          {mode === "signup" && (
            <p className="text-center text-[10px] text-gray-400 dark:text-slate-500 mt-3">
              Only <span className="font-semibold text-[#003366] dark:text-blue-400">@xmu.edu.my</span> emails are accepted.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
