import { useState, useEffect, useRef, useCallback } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getUserListings, deleteListing } from "@/lib/listings";
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  changePassword as doChangePassword,
} from "@/lib/userProfile";
import { Listing, UserProfile } from "@/lib/types";
import ListingCard from "@/components/ListingCard";
import AuthModal from "@/components/AuthModal";
import VerificationBanner from "@/components/VerificationBanner";
import {
  User,
  CheckCircle,
  AlertCircle,
  LogOut,
  CheckCircle2,
  Camera,
  LayoutList,
  Settings2,
} from "lucide-react";
import { logOut } from "@/lib/auth";
import { useLocation } from "wouter";

// ── Success toast (used for deletion) ─────────────────────────────────────────
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

// ── Privacy toggle row ─────────────────────────────────────────────────────────
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

export default function ProfilePage() {
  const { t } = useLang();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // ── Tab ──────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"listings" | "settings">("listings");

  // ── Auth modal (shown when not logged in) ─────────────────────────────────────
  const [showAuth, setShowAuth] = useState(false);

  // ── Listings + delete (all existing logic preserved) ──────────────────────────
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getUserListings(user.uid).then(setListings).finally(() => setLoading(false));
  }, [user]);

  // ── Profile / settings ────────────────────────────────────────────────────────
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

  // ── Avatar ────────────────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ── Password ──────────────────────────────────────────────────────────────────
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmNewPass, setConfirmNewPass] = useState("");
  const [changingPass, setChangingPass] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSaved, setPassSaved] = useState(false);

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

  // ── Logged-out guard ──────────────────────────────────────────────────────────
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

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleDelete = async (listing: Listing) => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteListing(listing);
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      setDeleteTarget(null);
      setSuccessToast("Your post has been deleted successfully.");
    } catch (err: any) {
      console.error("[ProfilePage] Delete failed:", err?.code, err?.message);
      const code: string = err?.code ?? "";
      if (code === "permission-denied" || code === "storage/unauthorized") {
        setDeleteError("Permission denied. Make sure you are signed in with your XMUM email.");
      } else if (code === "not-found" || code === "storage/object-not-found") {
        setListings((prev) => prev.filter((l) => l.id !== listing.id));
        setDeleteTarget(null);
        setSuccessToast("Your post has been deleted successfully.");
      } else if (code === "unavailable" || code === "storage/retry-limit-exceeded") {
        setDeleteError("No connection. Please check your internet and try again.");
      } else {
        setDeleteError(err?.message ?? "Something went wrong. Please try again.");
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleSignOut = async () => {
    await logOut();
    navigate("/");
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so the same file can be re-selected after an error
    e.target.value = "";
    if (!file) return;

    setAvatarError("");

    // ── Client-side validation (mirrors backend Storage rules) ────────────────
    if (!file.type.startsWith("image/")) {
      setAvatarError("Only image files are allowed (JPG, PNG, WebP, etc.).");
      return;
    }
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setAvatarError(t.imageTooLarge);
      return;
    }

    // Optimistic preview — keep the previous URL so we can revert on failure
    const previousUrl = avatarUrl;
    setAvatarUrl(URL.createObjectURL(file));
    setUploadingAvatar(true);

    try {
      const url = await uploadAvatar(file, user.uid);
      await updateProfile(user.uid, { avatarUrl: url });
      setAvatarUrl(url);
    } catch (err: any) {
      // Revert the optimistic preview
      setAvatarUrl(previousUrl);

      const code: string = err?.code ?? "";
      console.error("[ProfilePage] Avatar upload failed:", code, err?.message);

      if (code === "storage/unauthorized" || code === "permission-denied") {
        setAvatarError("Upload blocked by server. Ensure your file is an image under 5 MB and you are signed in with your XMUM email.");
      } else if (code === "storage/quota-exceeded") {
        setAvatarError("Storage quota exceeded. Please contact support.");
      } else if (code === "storage/retry-limit-exceeded" || code === "storage/canceled") {
        setAvatarError("Upload failed due to a connection issue. Please check your internet and try again.");
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
    } catch (err) {
      console.error("[ProfilePage] Profile save failed:", err);
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
      // Revert on error
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

  // ── Avatar display helper ──────────────────────────────────────────────────────
  const AvatarDisplay = ({ size }: { size: "sm" | "lg" }) => {
    const cls = size === "lg" ? "w-20 h-20 text-2xl" : "w-14 h-14 text-xl";
    return avatarUrl ? (
      <img
        src={avatarUrl}
        alt="avatar"
        className={`${cls} rounded-full object-cover border-2 border-white shadow`}
      />
    ) : (
      <div className={`${cls} rounded-full bg-gradient-to-br from-[#003366] to-[#0055aa] flex items-center justify-center text-white font-bold shadow`}>
        {(user.email ?? "?")[0].toUpperCase()}
      </div>
    );
  };

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/30 focus:border-[#003366] transition";

  return (
    <>
      {successToast && (
        <SuccessToast message={successToast} onDone={() => setSuccessToast("")} />
      )}

      {!user.emailVerified && <VerificationBanner />}

      <div className="max-w-5xl mx-auto px-4 py-5">
        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 flex items-center gap-4">
          <AvatarDisplay size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {fullName || user.email?.split("@")[0]}
            </p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
            <span className={`inline-flex items-center gap-1 text-xs font-medium mt-1 px-2 py-0.5 rounded-full ${user.emailVerified ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
              {user.emailVerified
                ? <><CheckCircle size={10} />{t.verifiedBadge}</>
                : <><AlertCircle size={10} />{t.unverifiedBadge}</>}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0"
          >
            <LogOut size={14} />
            {t.signOut}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
          <button
            onClick={() => setActiveTab("listings")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "listings" ? "bg-white shadow text-[#003366]" : "text-gray-500"}`}
          >
            <LayoutList size={15} />
            {t.myListings}
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "settings" ? "bg-white shadow text-[#003366]" : "text-gray-500"}`}
          >
            <Settings2 size={15} />
            Settings
          </button>
        </div>

        {/* ── My Listings tab ─────────────────────────────────────────────────── */}
        {activeTab === "listings" && (
          <>
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                    <div className="h-44 bg-gray-100" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                      <div className="h-2 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-sm">{t.noListings}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {listings.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    showDelete
                    onDelete={() => setDeleteTarget(l)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Settings tab ────────────────────────────────────────────────────── */}
        {activeTab === "settings" && (
          <div className="space-y-4 max-w-lg">

            {/* Avatar */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">Profile Photo</h3>
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <AvatarDisplay size="lg" />
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
          </div>
        )}
      </div>

      {/* Delete confirmation modal (unchanged) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <p className="font-semibold text-gray-800 mb-1">{t.deleteConfirm}</p>
            <p className="text-xs text-gray-500 mb-4 truncate">{deleteTarget.title}</p>
            {deleteError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
                {deleteError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(""); }}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {deleting ? "…" : t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
