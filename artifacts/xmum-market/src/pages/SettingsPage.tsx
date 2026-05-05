import { useState, useEffect, useRef } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  changePassword as doChangePassword,
  deleteAccount,
} from "@/lib/userProfile";
import { UserProfile } from "@/lib/types";
import AuthModal from "@/components/AuthModal";
import VerificationBanner from "@/components/VerificationBanner";
import {
  User,
  CheckCircle,
  AlertCircle,
  Camera,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { useLocation } from "wouter";

function SuccessToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const hide = setTimeout(() => setVisible(false), 3000);
    const done = setTimeout(onDone, 3400);
    return () => { clearTimeout(hide); clearTimeout(done); };
  }, [onDone]);
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#003366] text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl transition-all duration-400 ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"}`}>
      <CheckCircle2 size={18} className="text-green-300 shrink-0" />
      {message}
    </div>
  );
}

function PrivacyRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0 ml-4 ${value ? "bg-[#003366]" : "bg-gray-200"}`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${value ? "left-6" : "left-1"}`}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [showAuth, setShowAuth] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [settingsWhatsapp, setSettingsWhatsapp] = useState("");
  const [settingsWechat, setSettingsWechat] = useState("");
  const [showEmail, setShowEmail] = useState(true);
  const [showWhatsApp, setShowWhatsApp] = useState(true);
  const [showWeChat, setShowWeChat] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Password state
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmNewPass, setConfirmNewPass] = useState("");
  const [changingPass, setChangingPass] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSaved, setPassSaved] = useState(false);

  // Account deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!user) return;
    getProfile(user.uid).then((p) => {
      if (!p) return;
      setProfile(p);
      setFullName(p.fullName ?? "");
      setSettingsWhatsapp(p.whatsapp ?? "");
      setSettingsWechat(p.wechat ?? "");
      setShowEmail(p.showEmail ?? true);
      setShowWhatsApp(p.showWhatsApp ?? true);
      setShowWeChat(p.showWeChat ?? true);
      setAvatarUrl(p.avatarUrl ?? "");
    }).catch(() => {});
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <User size={48} className="text-gray-200 mb-4" />
        <p className="text-gray-600 font-medium mb-1">{t.loginToPost}</p>
        <button
          onClick={() => setShowAuth(true)}
          className="mt-3 bg-[#003366] text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
        >
          {t.signIn}
        </button>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError("");
    if (!file.type.startsWith("image/")) {
      setAvatarError("Only image files are allowed (JPG, PNG, WebP, etc.).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(t.imageTooLarge);
      return;
    }
    const previousUrl = avatarUrl;
    setAvatarUrl(URL.createObjectURL(file));
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(file, user.uid);
      await updateProfile(user.uid, { avatarUrl: url });
      setAvatarUrl(url);
    } catch (err: any) {
      setAvatarUrl(previousUrl);
      const code: string = err?.code ?? "";
      if (code === "storage/unauthorized" || code === "permission-denied") {
        setAvatarError("Upload blocked. Ensure your file is an image under 5 MB and you are signed in with your XMUM email.");
      } else if (code === "storage/quota-exceeded") {
        setAvatarError("Storage quota exceeded. Please contact support.");
      } else if (code === "storage/retry-limit-exceeded" || code === "storage/canceled") {
        setAvatarError("Upload failed due to a connection issue. Please try again.");
      } else {
        setAvatarError("Upload failed. Please try again.");
      }
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
      await updateProfile(user.uid, {
        fullName: fullName.trim(),
        whatsapp: settingsWhatsapp.trim(),
        wechat: settingsWechat.trim(),
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch {
      setProfileError("Failed to save. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePrivacyToggle = async (
    field: "showEmail" | "showWhatsApp" | "showWeChat",
    value: boolean
  ) => {
    if (field === "showEmail") setShowEmail(value);
    else if (field === "showWhatsApp") setShowWhatsApp(value);
    else setShowWeChat(value);
    try {
      await updateProfile(user.uid, { [field]: value });
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
      if (code.includes("wrong-password") || code.includes("invalid-credential")) {
        setPassError("Current password is incorrect.");
      } else {
        setPassError(err?.message ?? "Failed to update password.");
      }
    } finally {
      setChangingPass(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    if (!deletePassword) { setDeleteError("Please enter your password to confirm."); return; }
    setDeletingAccount(true);
    try {
      await deleteAccount(deletePassword);
      // Auth user is now gone — navigate home and show toast
      navigate("/");
      setSuccessToast("Your account has been permanently deleted.");
    } catch (err: any) {
      const code = err?.code ?? "";
      if (code.includes("wrong-password") || code.includes("invalid-credential")) {
        setDeleteError("Incorrect password. Please try again.");
      } else if (code === "auth/requires-recent-login") {
        setDeleteError("Session expired. Please sign out, sign back in, and try again.");
      } else {
        setDeleteError(err?.message ?? "Failed to delete account. Please try again.");
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  const AvatarDisplay = () =>
    avatarUrl ? (
      <img src={avatarUrl} alt="avatar" className="w-20 h-20 rounded-full object-cover border-2 border-white shadow" />
    ) : (
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#003366] to-[#0055aa] flex items-center justify-center text-white font-bold text-2xl shadow">
        {(user.email ?? "?")[0].toUpperCase()}
      </div>
    );

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366] transition";

  return (
    <>
      {successToast && <SuccessToast message={successToast} onDone={() => setSuccessToast("")} />}
      {!user.emailVerified && <VerificationBanner />}

      <div className="max-w-5xl mx-auto px-4 py-5">
        <h2 className="text-lg font-bold text-gray-900 mb-5">{t.accountSettings}</h2>

        <div className="space-y-4 max-w-lg">

          {/* Avatar */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Profile Photo</h3>
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <AvatarDisplay />
                {uploadingAvatar && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div>
                <button
                  onClick={() => { setAvatarError(""); avatarInputRef.current?.click(); }}
                  disabled={uploadingAvatar}
                  className="flex items-center gap-1.5 text-sm text-[#003366] border border-[#003366]/30 px-3 py-2 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                >
                  <Camera size={14} />
                  {uploadingAvatar ? "Uploading…" : "Change Photo"}
                </button>
                <p className="text-[10px] text-gray-400 mt-1.5">JPG, PNG or WebP · Max 5 MB</p>
                {avatarError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 mt-2 max-w-[220px] leading-snug">
                    {avatarError}
                  </p>
                )}
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Profile Info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Profile Information</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  WhatsApp Number <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={settingsWhatsapp}
                  onChange={(e) => setSettingsWhatsapp(e.target.value)}
                  placeholder="+60 12-345 6789"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  WeChat ID <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={settingsWechat}
                  onChange={(e) => setSettingsWechat(e.target.value)}
                  placeholder="WeChat ID"
                  className={inputCls}
                />
              </div>
              {profileError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{profileError}</p>
              )}
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${profileSaved ? "bg-green-500 text-white" : "bg-[#003366] text-white hover:bg-[#002244]"}`}
              >
                {savingProfile ? "Saving…" : profileSaved ? "Saved!" : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Password */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Change Password</h3>
            <div className="space-y-3">
              <input
                type="password"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                placeholder="Current password"
                className={inputCls}
              />
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="New password (min 6 characters)"
                className={inputCls}
              />
              <input
                type="password"
                value={confirmNewPass}
                onChange={(e) => setConfirmNewPass(e.target.value)}
                placeholder="Confirm new password"
                className={inputCls}
              />
              {passError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{passError}</p>
              )}
              <button
                onClick={handleChangePassword}
                disabled={changingPass || !currentPass || !newPass || !confirmNewPass}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${passSaved ? "bg-green-500 text-white" : "bg-[#003366] text-white hover:bg-[#002244]"}`}
              >
                {changingPass ? "Updating…" : passSaved ? "Password Updated!" : "Update Password"}
              </button>
            </div>
          </div>

          {/* Privacy */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-1">Privacy Settings</h3>
            <p className="text-xs text-gray-400 mb-2">
              Control what contact info is visible to other users on your listings.
            </p>
            <div className="divide-y divide-gray-100">
              <PrivacyRow
                label="Show Email"
                sub="Allow others to see your email address"
                value={showEmail}
                onChange={(v) => handlePrivacyToggle("showEmail", v)}
              />
              <PrivacyRow
                label="Show WhatsApp"
                sub="Display WhatsApp contact button on your listings"
                value={showWhatsApp}
                onChange={(v) => handlePrivacyToggle("showWhatsApp", v)}
              />
              <PrivacyRow
                label="Show WeChat"
                sub="Display WeChat contact button on your listings"
                value={showWeChat}
                onChange={(v) => handlePrivacyToggle("showWeChat", v)}
              />
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white rounded-2xl border border-red-200 p-5">
            <h3 className="text-sm font-bold text-red-700 mb-1">Danger Zone</h3>
            <p className="text-xs text-gray-500 mb-4">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
            <button
              onClick={() => { setDeleteError(""); setDeletePassword(""); setShowDeleteModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Trash2 size={15} />
              Delete Account
            </button>
          </div>

        </div>
      </div>

      {/* Account deletion confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <Trash2 size={15} className="text-red-600" />
              </div>
              <p className="font-bold text-gray-900">Delete Account Permanently</p>
            </div>
            <p className="text-xs text-gray-500 mb-1">This will immediately and permanently delete:</p>
            <ul className="text-xs text-gray-500 mb-4 list-disc list-inside space-y-0.5 ml-1">
              <li>All your listings and their photos</li>
              <li>Your profile photo and account data</li>
              <li>Your login credentials</li>
            </ul>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Enter your password to confirm:
            </label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDeleteAccount()}
              placeholder="Your current password"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition mb-3"
              autoFocus
            />
            {deleteError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
                {deleteError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteModal(false); setDeletePassword(""); setDeleteError(""); }}
                disabled={deletingAccount}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || !deletePassword}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-red-700 transition-colors"
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
