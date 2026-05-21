import { useState, useEffect, useRef } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  updateProfile,
  changePassword as doChangePassword,
  deleteAccount,
} from "@/lib/userProfile";
import { validateWhatsApp, suggestMalaysianFormat } from "@/lib/validation";
import AuthModal from "@/components/AuthModal";
import VerificationBanner from "@/components/VerificationBanner";
import AvatarCropModal from "@/components/AvatarCropModal";
import {
  User, Camera, CheckCircle2, Trash2, Settings, AlertCircle,
  Eye, EyeOff, Lock, LogOut,
  CheckCircle, MessageCircle,
} from "lucide-react";
import ReportHoldModal from "@/components/ReportHoldModal";
import { useLocation } from "wouter";
import { auth } from "@/lib/firebase";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { logOut } from "@/lib/auth";

const inputCls =
  "w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#003366]/40 dark:focus:ring-blue-500/40 focus:border-[#003366] dark:focus:border-blue-500 transition min-h-[44px]";

const labelCls = "block text-xs font-display font-medium text-gray-500 dark:text-slate-400 mb-1.5";

function SuccessToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const hide = setTimeout(() => setVisible(false), 3000);
    const done = setTimeout(onDone, 3400);
    return () => { clearTimeout(hide); clearTimeout(done); };
  }, [onDone]);
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#003366] dark:bg-blue-700 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl transition-all duration-400 ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"}`}>
      <CheckCircle2 size={16} className="text-green-300 shrink-0" />
      {message}
    </div>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
      <span className="text-[#003366] dark:text-blue-400">{icon}</span>
      <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</h3>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-gray-100 dark:bg-slate-700 mx-4" />;
}

function InlineToggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      title={value ? `Hide ${label}` : `Show ${label}`}
      className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-all shrink-0 ${
        value
          ? "bg-[#003366]/8 dark:bg-blue-500/15 border-[#003366]/20 dark:border-blue-500/30 text-[#003366] dark:text-blue-400"
          : "bg-gray-100 dark:bg-slate-600/40 border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-500"
      }`}
    >
      {value ? <Eye size={11} /> : <EyeOff size={11} />}
      {value ? "Visible" : "Hidden"}
    </button>
  );
}

function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 animate-pulse">
      <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/4 mb-5" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 dark:bg-slate-700 rounded-xl" />
        ))}
        <div className="h-10 bg-gray-200 dark:bg-slate-700 rounded-xl" />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useLang();
  const { user, userProfile, loading: authLoading, refetchProfile, setAvatarOverride } = useAuth();
  const [, navigate] = useLocation();
  const { dark, toggle: toggleDark } = useDarkMode();

  const [showAuth, setShowAuth] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  const [fullName, setFullName] = useState("");
  const [settingsWhatsapp, setSettingsWhatsapp] = useState("");
  const [settingsWhatsappError, setSettingsWhatsappError] = useState("");
  const [settingsWechat, setSettingsWechat] = useState("");
  const [showWhatsApp, setShowWhatsApp] = useState(true);
  const [showWeChat, setShowWeChat] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmNewPass, setConfirmNewPass] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSaved, setPassSaved] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showHoldModal, setShowHoldModal] = useState(false);
  const deletingAccountRef = useRef(false);

  useEffect(() => {
    if (!userProfile) return;
    setFullName(userProfile.fullName ?? "");
    setSettingsWhatsapp(userProfile.whatsapp ?? "");
    setSettingsWechat(userProfile.wechat ?? "");
    setShowWhatsApp(userProfile.showWhatsApp ?? true);
    setShowWeChat(userProfile.showWeChat ?? true);
  }, [userProfile]);

  if (!user) {
    if (deletingAccountRef.current) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <div className="w-8 h-8 border-2 border-[#003366] dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-slate-400">Deleting your account…</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <User size={48} className="text-gray-200 dark:text-slate-600 mb-4" />
        <p className="text-gray-600 dark:text-slate-300 font-medium mb-1">{t.loginToPost}</p>
        <button onClick={() => setShowAuth(true)} className="mt-3 bg-[#003366] dark:bg-blue-600 text-white px-5 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold">
          {t.signIn}
        </button>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-5">
        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-32 mb-5 animate-pulse" />
        <div className="space-y-4">
          <SkeletonCard rows={3} />
          <SkeletonCard rows={2} />
        </div>
      </div>
    );
  }

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;
    setCropFile(file);
  };

  const handleCropSuccess = async (url: string) => {
    setCropFile(null);
    setAvatarPreview(url);
    setAvatarOverride(url);
    await updateProfile(user.uid, { avatarUrl: url }).catch(() => {});
    await refetchProfile().catch(() => {});
    setAvatarOverride(null);
    setAvatarPreview(null);
    setSuccessToast("Profile photo updated.");
  };

  const handleSaveProfile = async () => {
    setProfileError("");
    setProfileSaved(false);
    if (!fullName.trim()) { setProfileError("Full name cannot be empty."); return; }
    if (settingsWhatsapp.trim()) {
      const result = validateWhatsApp(settingsWhatsapp);
      if (!result.valid) {
        setSettingsWhatsappError(result.error);
        setProfileError(result.error);
        return;
      }
    }
    setSavingProfile(true);
    try {
      await Promise.race([
        updateProfile(user.uid, {
          fullName: fullName.trim(),
          whatsapp: settingsWhatsapp.trim(),
          wechat: settingsWechat.trim(),
          showWhatsApp,
          showWeChat,
        }),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8_000)),
      ]);
      await refetchProfile();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      if (err?.message === "timeout") {
        await refetchProfile().catch(() => {});
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 3000);
      } else {
        setProfileError("Failed to save. Please try again.");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePrivacyToggle = async (field: "showWhatsApp" | "showWeChat", value: boolean) => {
    if (field === "showWhatsApp") setShowWhatsApp(value);
    else setShowWeChat(value);
    try {
      await updateProfile(user.uid, { [field]: value });
      await refetchProfile().catch(() => {});
    } catch {
      if (field === "showWhatsApp") setShowWhatsApp(!value);
      else setShowWeChat(!value);
    }
  };

  const handleChangePassword = async () => {
    setPassError("");
    setPassSaved(false);
    if (newPass.length < 8) { setPassError(t.passwordTooShort); return; }
    if (newPass.length > 32) { setPassError(t.passwordTooLong); return; }
    if (!/[a-zA-Z]/.test(newPass) || !/[0-9]/.test(newPass)) { setPassError(t.passwordTooWeak); return; }
    if (newPass !== confirmNewPass) { setPassError("Passwords do not match."); return; }
    setChangingPass(true);
    try {
      await doChangePassword(currentPass, newPass);
      setPassSaved(true);
      setCurrentPass(""); setNewPass(""); setConfirmNewPass("");
      setTimeout(() => setPassSaved(false), 3000);
    } catch (err: any) {
      const code = err?.code ?? "";
      if (code.includes("wrong-password") || code.includes("invalid-credential")) setPassError("Current password is incorrect.");
      else setPassError(err?.message ?? "Failed to update password.");
    } finally {
      setChangingPass(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    if (!deletePassword) { setDeleteError("Please enter your password to confirm."); return; }
    deletingAccountRef.current = true;
    setDeletingAccount(true);
    try {
      await deleteAccount(deletePassword);
      navigate("/");
    } catch (err: any) {
      const code = err?.code ?? "";
      if (code === "report-hold-account") {
        setShowHoldModal(true);
        deletingAccountRef.current = false;
        setDeletingAccount(false);
        return;
      }
      if (code.includes("wrong-password") || code.includes("invalid-credential")) setDeleteError("Incorrect password. Please try again.");
      else if (code === "auth/requires-recent-login") setDeleteError("Session expired. Please sign out, sign back in, and try again.");
      else setDeleteError(err?.message ?? "Failed to delete account. Please try again.");
    } finally {
      if (auth.currentUser) { deletingAccountRef.current = false; setDeletingAccount(false); }
    }
  };

  const avatarSrc = avatarPreview ?? userProfile?.avatarUrl;

  const AvatarDisplay = () =>
    avatarSrc ? (
      <img src={avatarSrc} alt="avatar" className="w-16 h-16 rounded-full object-cover ring-2 ring-white dark:ring-slate-700 shadow-md" />
    ) : (
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#003366] to-[#0055aa] flex items-center justify-center text-white font-bold text-xl shadow-md">
        {(user.email ?? "?")[0].toUpperCase()}
      </div>
    );

  const passwordStrength = (() => {
    if (!newPass) return null;
    const hasLetter = /[a-zA-Z]/.test(newPass);
    const hasNumber = /[0-9]/.test(newPass);
    const hasSpecial = /[^a-zA-Z0-9]/.test(newPass);
    const score = (newPass.length >= 8 ? 1 : 0) + (hasLetter ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSpecial ? 1 : 0);
    if (score <= 2) return { label: t.passwordStrengthWeak, color: "bg-red-400", width: "w-1/3" };
    if (score === 3) return { label: t.passwordStrengthFair, color: "bg-amber-400", width: "w-2/3" };
    return { label: t.passwordStrengthStrong, color: "bg-green-500", width: "w-full" };
  })();

  return (
    <>
      {successToast && <SuccessToast message={successToast} onDone={() => setSuccessToast("")} />}
      {!user.emailVerified && <VerificationBanner />}

      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          uid={user.uid}
          onSuccess={handleCropSuccess}
          onCancel={() => setCropFile(null)}
        />
      )}

      <div className="max-w-lg mx-auto px-4 py-5 pb-28 sm:pb-8 animate-in fade-in duration-200">

        {/* Page tab bar */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 mb-5">
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors -mb-px"
          >
            {t.myListings}
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 border-[#003366] dark:border-blue-400 text-[#003366] dark:text-blue-400 -mb-px">
            <Settings size={13} />
            {t.accountSettings}
          </button>
        </div>

        {/* ── PROFILE CARD ─────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 mb-3 overflow-hidden">
          <SectionHeader icon={<User size={13} />} label="Profile" />
          <Divider />

          {/* Avatar row */}
          <div className="px-4 py-4 flex items-center gap-4">
            <div className="relative shrink-0">
              <AvatarDisplay />
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-[#003366] dark:bg-blue-600 rounded-full flex items-center justify-center shadow-md hover:bg-[#002244] transition-colors"
                title="Change photo"
              >
                <Camera size={11} className="text-white" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                {userProfile?.fullName || user.email?.split("@")[0] || "—"}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {user.emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                    <CheckCircle size={9} /> XMUM Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                    <AlertCircle size={9} /> Unverified
                  </span>
                )}
                <a
                  href={`/seller/${user.uid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-slate-500 hover:text-[#003366] dark:hover:text-blue-400 transition-colors"
                >
                  <Eye size={9} /> View public profile
                </a>
              </div>
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="shrink-0 text-xs text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors hidden sm:block"
            >
              Change photo
            </button>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 px-4 pb-3 -mt-1">JPG, PNG or WebP · Max 5 MB</p>

          <Divider />

          {/* Form fields */}
          <div className="px-4 py-4 space-y-4">
            <div>
              <label className={labelCls}>Full Name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className={inputCls}
              />
            </div>

            {/* WhatsApp with inline visibility toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  WhatsApp <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span>
                </label>
                <InlineToggle value={showWhatsApp} onChange={(v) => handlePrivacyToggle("showWhatsApp", v)} label="WhatsApp" />
              </div>
              <input
                type="text"
                value={settingsWhatsapp}
                onChange={(e) => { setSettingsWhatsapp(e.target.value); setSettingsWhatsappError(""); }}
                onBlur={() => {
                  const result = validateWhatsApp(settingsWhatsapp);
                  if (!result.valid && settingsWhatsapp.trim()) {
                    const suggested = suggestMalaysianFormat(settingsWhatsapp);
                    setSettingsWhatsappError(suggested !== settingsWhatsapp ? result.error + ` Did you mean ${suggested}?` : result.error);
                  }
                }}
                placeholder="+60123456789"
                className={inputCls}
              />
              {settingsWhatsappError ? (
                <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} /> {settingsWhatsappError}
                </p>
              ) : (
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">Include country code, e.g. +60 for Malaysia</p>
              )}
            </div>

            {/* WeChat with inline visibility toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  WeChat ID <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span>
                </label>
                <InlineToggle value={showWeChat} onChange={(v) => handlePrivacyToggle("showWeChat", v)} label="WeChat" />
              </div>
              <input
                type="text"
                value={settingsWechat}
                onChange={(e) => setSettingsWechat(e.target.value)}
                placeholder="WeChat ID"
                className={inputCls}
              />
            </div>

            {profileError && (
              <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {profileError}
              </div>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className={`w-full min-h-[44px] py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                profileSaved
                  ? "bg-green-500 text-white"
                  : "bg-[#003366] dark:bg-blue-600 text-white hover:bg-[#002244] dark:hover:bg-blue-700 active:scale-[0.98]"
              }`}
            >
              {savingProfile ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving…
                </span>
              ) : profileSaved ? (
                <span className="flex items-center justify-center gap-1.5"><CheckCircle2 size={15} /> Saved!</span>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileSelect} />
        </div>

        {/* ── SECURITY CARD ────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 mb-3 overflow-hidden">
          <SectionHeader icon={<Lock size={13} />} label="Security" />
          <Divider />
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className={labelCls}>Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPass ? "text" : "password"}
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  placeholder="Enter current password"
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showCurrentPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls}>New Password</label>
              <div className="relative">
                <input
                  type={showNewPass ? "text" : "password"}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Min 8 chars, include a number"
                  maxLength={32}
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {/* Password strength bar */}
              {passwordStrength && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-600 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color} ${passwordStrength.width}`} />
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0">{passwordStrength.label}</span>
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>Confirm New Password</label>
              <input
                type="password"
                value={confirmNewPass}
                onChange={(e) => setConfirmNewPass(e.target.value)}
                placeholder="Re-enter new password"
                className={inputCls}
              />
              {confirmNewPass && newPass !== confirmNewPass && (
                <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={11} /> Passwords do not match
                </p>
              )}
            </div>

            {passError && (
              <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {passError}
              </div>
            )}

            <button
              onClick={handleChangePassword}
              disabled={changingPass || !currentPass || !newPass || !confirmNewPass}
              className={`w-full min-h-[44px] py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 ${
                passSaved
                  ? "bg-green-500 text-white"
                  : "bg-[#003366] dark:bg-blue-600 text-white hover:bg-[#002244] dark:hover:bg-blue-700 active:scale-[0.98]"
              }`}
            >
              {changingPass ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Updating…
                </span>
              ) : passSaved ? (
                <span className="flex items-center justify-center gap-1.5"><CheckCircle2 size={15} /> Password Updated!</span>
              ) : (
                "Update Password"
              )}
            </button>
          </div>
        </div>

        {/* ── ACCOUNT CARD ─────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 mb-3 overflow-hidden">
          <SectionHeader icon={<User size={13} />} label="Account" />
          <Divider />
          <div className="px-2 py-2">
            <button
              onClick={async () => { await logOut(); navigate("/"); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                <MessageCircle size={15} className="text-gray-400 dark:text-slate-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-slate-100">{t.signOut}</p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500">Sign out of your XMUM Market account</p>
              </div>
            </button>

            <Divider />

            <button
              onClick={() => { setDeleteError(""); setDeletePassword(""); setShowDeleteModal(true); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group mt-1"
            >
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                <Trash2 size={15} className="text-red-500 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Delete Account</p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500">Permanently remove your account and all data</p>
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* Account deletion modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-slate-100 text-base">Delete Account</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2.5 mb-4">
              <p className="text-xs text-red-700 dark:text-red-300 font-medium mb-1">This will permanently delete:</p>
              <ul className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                <li>• Your account and profile</li>
                <li>• All your listings and photos</li>
                <li>• Your messages and conversations</li>
              </ul>
            </div>

            <label className={labelCls}>Enter your password to confirm</label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Your current password"
              className={`${inputCls} mb-3`}
            />
            {deleteError && (
              <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 mb-3">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                {deleteError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteModal(false); setDeletePassword(""); setDeleteError(""); }}
                className="flex-1 min-h-[44px] border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || !deletePassword}
                className="flex-1 min-h-[44px] bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {deletingAccount ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Deleting…
                  </span>
                ) : (
                  "Delete Account"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {showHoldModal && (
        <ReportHoldModal action="delete" context="account" onClose={() => setShowHoldModal(false)} />
      )}
    </>
  );
}
