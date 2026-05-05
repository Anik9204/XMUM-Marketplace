import { useState } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { signIn, signUp, resetPassword, isXmuEmail } from "@/lib/auth";
import { X, Eye, EyeOff } from "lucide-react";

type Mode = "signin" | "signup" | "forgot";

interface Props {
  onClose: () => void;
  defaultMode?: Mode;
}

export default function AuthModal({ onClose, defaultMode = "signin" }: Props) {
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

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
        if (!isXmuEmail(email)) { setError(t.onlyXmuEmail); setLoading(false); return; }
        if (password.length < 6) { setError(t.weakPassword); setLoading(false); return; }
        if (password !== confirmPass) { setError(t.passwordsNoMatch); setLoading(false); return; }
        await signUp(email, password);
        setSuccess(t.verifyEmailMsg);
        setMode("signin");
      } else {
        await signIn(email, password);
        onClose();
      }
    } catch (err: any) {
      const code = err?.code ?? err?.message ?? "";
      if (code === "only_xmu_email" || code.includes("only_xmu")) setError(t.onlyXmuEmail);
      else if (code.includes("wrong-password") || code.includes("invalid-credential")) setError("Invalid email or password.");
      else if (code.includes("user-not-found")) setError("No account found with this email.");
      else if (code.includes("email-already-in-use")) setError("An account already exists with this email.");
      else setError(t.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden">
        {/* Top accent */}
        <div className="h-1.5 bg-gradient-to-r from-[#003366] to-[#0055aa]" />

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <div className="p-6">
          {/* Logo / Brand */}
          <div className="text-center mb-5">
            <h2 className="text-xl font-bold text-[#003366]">{t.appName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {mode === "forgot" ? t.resetPassword : mode === "signup" ? t.createAccount : t.welcomeBack}
            </p>
          </div>

          {/* Mode tabs — only for sign in / sign up */}
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

            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#003366] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#002244] disabled:opacity-50 transition-colors mt-1"
            >
              {loading ? t.loading : mode === "forgot" ? t.sendResetEmail : mode === "signup" ? t.createAccount : t.signIn}
            </button>
          </form>

          {mode === "signin" && (
            <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }} className="w-full text-center text-xs text-[#003366] hover:underline mt-3">
              {t.forgotPassword}
            </button>
          )}

          {mode === "forgot" && (
            <button onClick={() => { setMode("signin"); setError(""); setSuccess(""); }} className="w-full text-center text-xs text-[#003366] hover:underline mt-3">
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
