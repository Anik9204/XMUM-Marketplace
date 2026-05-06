import { useState } from "react";
import { useLocation } from "wouter";
import { confirmPasswordReset } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useLang } from "@/contexts/LanguageContext";
import { Eye, EyeOff, KeyRound, CheckCircle2, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const { t } = useLang();
  const [, navigate] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const oobCode = params.get("oobCode") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleGoHome = () => {
    window.history.replaceState({}, "", "/");
    navigate("/");
  };

  // ── Invalid / missing code ───────────────────────────────────────────────────
  if (!oobCode) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 w-full max-w-sm p-8 text-center">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-500" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {t.expiredResetLink}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {t.requestNewLink}
          </p>
          <button
            onClick={handleGoHome}
            className="w-full bg-[#003366] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#002244] transition-colors"
          >
            {t.backToSignIn}
          </button>
        </div>
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 w-full max-w-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {t.resetPassword}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {t.passwordResetSuccess}
          </p>
          <button
            onClick={handleGoHome}
            className="w-full bg-[#003366] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#002244] transition-colors"
          >
            {t.signInNow}
          </button>
        </div>
      </div>
    );
  }

  // ── Reset form ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError(t.weakPassword);
      return;
    }
    if (password !== confirm) {
      setError(t.passwordsNoMatch);
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      window.history.replaceState({}, "", "/");
      setSuccess(true);
    } catch (err: any) {
      const code = err?.code ?? "";
      if (
        code.includes("expired-action-code") ||
        code.includes("invalid-action-code")
      ) {
        setError(t.expiredResetLink);
      } else {
        setError(t.errorOccurred);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 w-full max-w-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#003366] to-[#0055aa]" />

        <div className="p-8">
          <div className="flex items-center justify-center w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-full mx-auto mb-4">
            <KeyRound size={26} className="text-[#003366] dark:text-blue-400" />
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-[#003366] dark:text-white">
              {t.resetPasswordConfirm}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t.appName}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                {t.newPassword}
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                {t.confirmPassword}
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg px-3 py-2">
                {error}
                {error === t.expiredResetLink && (
                  <button
                    type="button"
                    onClick={handleGoHome}
                    className="block mt-1 underline font-medium"
                  >
                    {t.requestNewLink}
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#003366] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#002244] disabled:opacity-50 transition-colors"
            >
              {loading ? t.loading : t.resetPassword}
            </button>
          </form>

          <button
            onClick={handleGoHome}
            className="w-full text-center text-xs text-[#003366] dark:text-blue-400 hover:underline mt-4"
          >
            {t.backToSignIn}
          </button>
        </div>
      </div>
    </div>
  );
}
