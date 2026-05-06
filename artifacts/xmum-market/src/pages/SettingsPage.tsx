import { useState, useEffect, useRef } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  updateProfile,
  uploadAvatar,
  changePassword as doChangePassword,
  deleteAccount,
} from "@/lib/userProfile";
import AuthModal from "@/components/AuthModal";
import VerificationBanner from "@/components/VerificationBanner";
import { User, Camera, CheckCircle2, Trash2, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { auth } from "@/lib/firebase";

const inputCls =
  "w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition min-h-[44px]";

const labelCls = "block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1";

function SuccessToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const hide = setTimeout(() => setVisible(false), 3000);
    const done = setTimeout(onDone, 3400);
    return () => { clearTimeout(hide); clearTimeout(done); };
  }, [onDone]);
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#003366] dark:bg-blue-700 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl transition-all duration-400 ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"}`}>
      <CheckCircle2 size={18} className="text-green-300 shrink-0" />
      {message}
    </div>
  );
}

function PrivacyRow({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{label}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0 ml-4 ${value ? "bg-[#003366] dark:bg-blue-600" : "bg-gray-200 dark:bg-slate-600"}`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${value ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 animate-pulse">
      <div className="h-3.5 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-5" />
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

  const [showAuth, setShowAuth] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  const [fullName, setFullName] = useState("");
  const [settingsWhatsapp, setSettingsWhatsapp] = useState("");
  const [settingsWechat, setSettingsWechat] = useState("");
  const [showEmail, setShowEmail] = useState(true);
  const [showWhatsApp, setShowWhatsApp] = useState(true);
  const [showWeChat, setShowWeChat] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Local preview URL (object URL) shown instantly before Storage upload completes.
  // When null, falls back to userProfile.avatarUrl from context.
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmNewPass, setConfirmNewPass] = useState("");
  const [changingPass, setChangingPass] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSaved, setPassSaved] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const deletingAccountRef = useRef(false);

  // Populate form state from context userProfile whenever it changes.
  // This handles initial load, tab navigation back, and post-save refresh.
  useEffect(() => {
    if (!userProfile) return;
    setFullName(userProfile.fullName ?? "");
    setSettingsWhatsapp(userProfile.whatsapp ?? "");
    setSettingsWechat(userProfile.wechat ?? "");
    setShowEmail(userProfile.showEmail ?? true);
    setShowWhatsApp(userProfile.showWhatsApp ?? true);
    setShowWeChat(userProfile.showWeChat ?? true);
    // Only reset avatarPreview when NOT mid-upload (don't flash old photo during upload)
    if (!uploadingAvatar) {
      setAvatarPreview(null);
    }
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
      <div className="max-w-5xl mx-auto px-4 py-5">
        <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded w-40 mb-5 animate-pulse" />
        <div className="space-y-4 max-w-lg">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 animate-pulse">
            <div className="h-3.5 bg-gray-200 dark:bg-slate-700 rounded w-1/4 mb-4" />
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-slate-700 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-8 bg-gray-100 dark:bg-slate-700 rounded-lg w-28" />
                <div className="h-2.5 bg-gray-100 dark:bg-slate-700 rounded w-36" />
              </div>
            </div>
          </div>
          <SkeletonCard rows={3} />
          <SkeletonCard rows={3} />
          <SkeletonCard rows={3} />
        </div>
      </div>
    );
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError("");
    if (!file.type.startsWith("image/")) { setAvatarError("Only image files are allowed (JPG, PNG, WebP, etc.)."); return; }
    if (file.size > 5 * 1024 * 1024) { setAvatarError(t.imageTooLarge); return; }

    // Fix A — instant local preview: show the new image the moment the user picks it,
    // before any network call. No network delay; the object URL reads directly from memory.
    const localPreviewUrl = URL.createObjectURL(file);
    setAvatarPreview(localPreviewUrl);
    // Fix C — propagate to context so ProfilePage and any other consumer also
    // shows the new photo instantly during the upload window.
    setAvatarOverride(localPreviewUrl);
    setUploadingAvatar(true);

    try {
      // uploadAvatar: uploads to Storage, gets download URL, writes to Firestore users/{uid}
      await uploadAvatar(file, user.uid);
      // Refresh context so userProfile.avatarUrl becomes the real Firebase Storage URL
      await refetchProfile();
      // Fix B — clean up: the real URL is now in context; revoke the object URL to free memory
      setAvatarOverride(null);
      URL.revokeObjectURL(localPreviewUrl);
      setAvatarPreview(null);
    } catch (err: any) {
      // On failure: revert the optimistic preview and clear the override
      setAvatarPreview(null);
      setAvatarOverride(null);
      URL.revokeObjectURL(localPreviewUrl);
      const code: string = err?.code ?? "";
      if (code === "storage/unauthorized" || code === "permission-denied") setAvatarError("Upload blocked. Ensure your file is an image under 5 MB and you are signed in with your XMUM email.");
      else if (code === "storage/quota-exceeded") setAvatarError("Storage quota exceeded. Please contact support.");
      else if (code === "storage/retry-limit-exceeded" || code === "storage/canceled") setAvatarError("Upload failed due to a connection issue. Please try again.");
      else setAvatarError("Upload failed. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileError("");
    setProfileSaved(false);
    if (!fullName.trim()) { setProfileError("Full name cannot be empty."); return; }
    setSavingProfile(true);
    try {
      await Promise.race([
        updateProfile(user.uid, { fullName: fullName.trim(), whatsapp: settingsWhatsapp.trim(), wechat: settingsWechat.trim() }),
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

  const handlePrivacyToggle = async (field: "showEmail" | "showWhatsApp" | "showWeChat", value: boolean) => {
    if (field === "showEmail") setShowEmail(value);
    else if (field === "showWhatsApp") setShowWhatsApp(value);
    else setShowWeChat(value);
    try {
      await updateProfile(user.uid, { [field]: value });
      await refetchProfile().catch(() => {});
    } catch {
      if (field === "showEmail") setShowEmail(!value);
      else if (field === "showWhatsApp") setShowWhatsApp(!value);
      else setShowWeChat(!value);
    }
  };

  const handleChangePassword = async () => {
    setPassError("");
    setPassSaved(false);
    if (newPass.length < 6) { setPassError("New password must be at least 6 characters."); return; }
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
      if (code.includes("wrong-password") || code.includes("invalid-credential")) setDeleteError("Incorrect password. Please try again.");
      else if (code === "auth/requires-recent-login") setDeleteError("Session expired. Please sign out, sign back in, and try again.");
      else setDeleteError(err?.message ?? "Failed to delete account. Please try again.");
    } finally {
      if (auth.currentUser) { deletingAccountRef.current = false; setDeletingAccount(false); }
    }
  };

  // Fix A — avatar display: use local object URL preview (instant) → fall back to
  // Firestore URL from context → fall back to initials placeholder.
  const avatarSrc = avatarPreview ?? userProfile?.avatarUrl;

  const AvatarDisplay = () =>
    avatarSrc ? (
      <img src={avatarSrc} alt="avatar" className="w-20 h-20 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow" />
    ) : (
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#003366] to-[#0055aa] flex items-center justify-center text-white font-bold text-2xl shadow">
        {(user.email ?? "?")[0].toUpperCase()}
      </div>
    );

  return (
    <>
      {successToast && <SuccessToast message={successToast} onDone={() => setSuccessToast("")} />}
      {!user.emailVerified && <VerificationBanner />}

      {/* pb-24 clears the 48px mobile bottom nav + breathing room; resets on sm+ */}
      <div className="max-w-5xl mx-auto px-4 py-5 pb-24 sm:pb-8 animate-in fade-in duration-200">
        {/* Tab bar — My Listings / Settings */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 mb-5">
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors -mb-px"
          >
            {t.myListings}
          </button>
          <button
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 border-[#003366] dark:border-blue-400 text-[#003366] dark:text-blue-400 -mb-px"
          >
            <Settings size={14} />
            {t.accountSettings}
          </button>
        </div>

        <div className="space-y-4 max-w-lg">
          {/* Avatar */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 mb-4">Profile Photo</h3>
            <div className="flex items-center gap-4">
              {/* Fix D — spinner overlay during upload, visible in both light and dark */}
              <div className="relative shrink-0">
                <AvatarDisplay />
                {uploadingAvatar && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div>
                <button
                  onClick={() => { setAvatarError(""); avatarInputRef.current?.click(); }}
                  disabled={uploadingAvatar}
                  className="flex items-center gap-1.5 text-sm text-[#003366] dark:text-blue-400 border border-[#003366]/30 dark:border-blue-500/30 px-3 min-h-[44px] py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 transition-colors"
                >
                  <Camera size={14} />
                  {uploadingAvatar ? "Uploading…" : "Change Photo"}
                </button>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1.5">JPG, PNG or WebP · Max 5 MB</p>
                {avatarError && (
                  <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg px-2.5 py-1.5 mt-2 max-w-[220px] leading-snug">
                    {avatarError}
                  </p>
                )}
              </div>
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* Profile Info */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 mb-4">Profile Information</h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Full Name <span className="text-red-500">*</span></label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>WhatsApp Number <span className="text-gray-400 dark:text-slate-500">(optional)</span></label>
                <input type="text" value={settingsWhatsapp} onChange={(e) => setSettingsWhatsapp(e.target.value)} placeholder="+60 12-345 6789" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>WeChat ID <span className="text-gray-400 dark:text-slate-500">(optional)</span></label>
                <input type="text" value={settingsWechat} onChange={(e) => setSettingsWechat(e.target.value)} placeholder="WeChat ID" className={inputCls} />
              </div>
              {profileError && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2">{profileError}</p>}
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className={`w-full min-h-[44px] py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${profileSaved ? "bg-green-500 text-white" : "bg-[#003366] dark:bg-blue-600 text-white hover:bg-[#002244] dark:hover:bg-blue-700"}`}
              >
                {savingProfile ? "Saving…" : profileSaved ? "Saved!" : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Password */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 mb-4">Change Password</h3>
            <div className="space-y-3">
              <input type="password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} placeholder="Current password" className={inputCls} />
              <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="New password (min 6 characters)" className={inputCls} />
              <input type="password" value={confirmNewPass} onChange={(e) => setConfirmNewPass(e.target.value)} placeholder="Confirm new password" className={inputCls} />
              {passError && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2">{passError}</p>}
              <button
                onClick={handleChangePassword}
                disabled={changingPass || !currentPass || !newPass || !confirmNewPass}
                className={`w-full min-h-[44px] py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${passSaved ? "bg-green-500 text-white" : "bg-[#003366] dark:bg-blue-600 text-white hover:bg-[#002244] dark:hover:bg-blue-700"}`}
              >
                {changingPass ? "Updating…" : passSaved ? "Password Updated!" : "Update Password"}
              </button>
            </div>
          </div>

          {/* Privacy */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 mb-1">Privacy Settings</h3>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Control what contact info is visible to other users on your listings.</p>
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              <PrivacyRow label="Show Email" sub="Allow others to see your email address" value={showEmail} onChange={(v) => handlePrivacyToggle("showEmail", v)} />
              <PrivacyRow label="Show WhatsApp" sub="Display WhatsApp contact button on your listings" value={showWhatsApp} onChange={(v) => handlePrivacyToggle("showWhatsApp", v)} />
              <PrivacyRow label="Show WeChat" sub="Display WeChat contact button on your listings" value={showWeChat} onChange={(v) => handlePrivacyToggle("showWeChat", v)} />
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-900/50 p-5">
            <h3 className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">Danger Zone</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
            <button
              onClick={() => { setDeleteError(""); setDeletePassword(""); setShowDeleteModal(true); }}
              className="flex items-center gap-2 px-4 min-h-[44px] py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Trash2 size={15} />
              Delete Account
            </button>
          </div>

        </div>
      </div>

      {/* Account deletion modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0">
                <Trash2 size={15} className="text-red-600 dark:text-red-400" />
              </div>
              <p className="font-bold text-gray-900 dark:text-slate-100">Delete Account Permanently</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">This will immediately and permanently delete:</p>
            <ul className="text-xs text-gray-500 dark:text-slate-400 mb-4 list-disc list-inside space-y-0.5 ml-1">
              <li>All your listings and their photos</li>
              <li>Your profile photo and account data</li>
              <li>Your login credentials</li>
            </ul>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5">Enter your password to confirm:</label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !deletingAccount && handleDeleteAccount()}
              placeholder="Your current password"
              className={`${inputCls} mb-3`}
              autoFocus
            />
            {deleteError && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteModal(false); setDeletePassword(""); setDeleteError(""); }}
                disabled={deletingAccount}
                className="flex-1 min-h-[44px] border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || !deletePassword}
                className="flex-1 min-h-[44px] bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-red-700 transition-colors"
              >
                {deletingAccount ? "Deleting…" : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
