"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import { FOCUS_MODES, REGIONS } from "@/lib/constants";
import { getTodayStr } from "@/lib/utils";
import { isNicknameTaken } from "@/lib/validators";
import { joinOfficialGroup, leaveOfficialGroup } from "@/lib/groups";
import { uploadAvatar, deleteAccount, submitReport, fetchNotificationPrefs, updateNotificationPrefs } from "@/lib/services/users";
import type { NotificationPrefs } from "@/types";
import ImageCropper from "@/components/ImageCropper";
import ConfirmModal from "@/components/ConfirmModal";
import { TermsModal, PrivacyModal, LegalNoticeModal } from "@/components/LegalModals";
import AsciiWarn from "@/components/AsciiWarn";
import { useAsciiInput } from "@/hooks/useAsciiInput";

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const { showWarn, sanitize } = useAsciiInput();

  const [nickname, setNickname] = useState(profile?.displayName || "");
  const [region, setRegion] = useState(profile?.region || "");
  const [goal, setGoal] = useState(profile?.goal || "");
  const [mainMode, setMainMode] = useState(profile?.mainMode || "");
  const [departureDate, setDepartureDate] = useState(profile?.departureDate || "");
  const [status, setStatus] = useState<"pre-departure" | "in-australia" | "post-return">(profile?.status || "pre-departure");
  const [showRegion, setShowRegion] = useState(profile?.showRegion !== false);
  const [saving, setSaving] = useState(false);
  const [nicknameError, setNicknameError] = useState("");
  const [activeSection, setActiveSection] = useState<"profile" | "notifications" | "report" | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({ likes: true, groupMessage: true, streakWarning: true });

  // Image crop
  const [cropSrc, setCropSrc] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Report
  const [reportTarget, setReportTarget] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportImage, setReportImage] = useState<File | null>(null);
  const [reportImagePreview, setReportImagePreview] = useState("");
  const reportFileRef = useRef<HTMLInputElement>(null);

  // Legal modals
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showTokusho, setShowTokusho] = useState(false);

  // Logout/Delete confirmation modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Load notification prefs
  useEffect(() => {
    if (!user) return;
    fetchNotificationPrefs(user.uid).then(setNotifPrefs).catch(console.error);
  }, [user]);

  const handleNotifToggle = async (key: keyof NotificationPrefs) => {
    if (!user) return;
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    await updateNotificationPrefs(user.uid, updated);
  };

  // Nickname uniqueness check
  useEffect(() => {
    if (!nickname.trim() || nickname.trim() === profile?.displayName) {
      setNicknameError("");
      return;
    }
    const timer = setTimeout(async () => {
      const taken = await isNicknameTaken(nickname.trim(), user?.uid);
      setNicknameError(taken ? "This nickname is already taken" : "");
    }, 500);
    return () => clearTimeout(timer);
  }, [nickname, profile?.displayName, user?.uid]);

  const handleSave = async () => {
    if (!user || !nickname.trim() || nicknameError) return;
    setSaving(true);
    try {
      if (nickname.trim() !== profile?.displayName) {
        const taken = await isNicknameTaken(nickname.trim(), user.uid);
        if (taken) {
          setNicknameError("This nickname is already taken");
          setSaving(false);
          return;
        }
      }
      // If mainMode changed, switch official group
      if (profile?.mainMode && profile.mainMode !== mainMode) {
        await leaveOfficialGroup(user.uid, profile.mainMode);
        await joinOfficialGroup(user.uid, mainMode);
      }

      await updateDoc(doc(db, "users", user.uid), {
        displayName: nickname.trim(),
        region: region.trim(),
        showRegion,
        goal: goal.trim(),
        mainMode,
        departureDate,
      });
      await refreshProfile();
      router.back();
    } catch (e) {
      console.error("Failed to save profile:", e);
    } finally {
      setSaving(false);
    }
  };

  const handlePhaseChange = async (newStatus: string) => {
    if (!user) return;
    const messages: Record<string, string> = {
      "in-australia": "Start your working holiday?",
      "post-return": "Change to post-return status?",
      "pre-departure": "Revert to pre-departure status?",
    };
    if (!confirm(messages[newStatus] || "Change your status?")) return;

    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "post-return") {
      updates.returnStartDate = getTodayStr();
    }

    await updateDoc(doc(db, "users", user.uid), updates);
    setStatus(newStatus as "pre-departure" | "in-australia" | "post-return");
    await refreshProfile();
  };

  const handleProfilePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (blob: Blob) => {
    if (!user) return;
    setCropSrc("");
    try {
      await uploadAvatar(user.uid, blob);
      await refreshProfile();
    } catch (e) {
      console.error("Failed to upload avatar:", e);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user || deleting) return;
    setDeleting(true);
    try {
      await deleteAccount(user);
      // deleteUser triggers onAuthStateChanged → clears user/profile
      router.replace("/login");
    } catch (e: unknown) {
      console.error("Account deletion failed:", e);
      const error = e as { code?: string };
      if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
        // User cancelled re-auth popup — do nothing
      } else {
        alert("Deletion failed. Please try again.");
      }
      setDeleting(false);
    }
  };

  const handleReportImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReportImage(file);
    setReportImagePreview(URL.createObjectURL(file));
  };

  const handleReport = async () => {
    if (!user || !reportTarget.trim() || !reportReason.trim() || !reportImage) return;
    try {
      await submitReport(user.uid, reportTarget.trim(), reportReason.trim(), reportImage);
      setReportTarget("");
      setReportReason("");
      setReportImage(null);
      setReportImagePreview("");
      setActiveSection(null);
    } catch (e) {
      console.error("Failed to submit report:", e);
    }
  };

  const toggle = (section: typeof activeSection) => {
    setActiveSection(activeSection === section ? null : section);
  };

  if (!profile) return null;

  return (
    <div className="min-h-dvh flex flex-col">
      <AsciiWarn show={showWarn} />
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropSrc("")}
          cropShape="round"
          outputSize={512}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center text-gray-400 text-xl -ml-2">←</button>
        <h1 className="text-lg font-bold">Settings</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {/* Profile Edit — Accordion */}
        <button
          onClick={() => toggle("profile")}
          className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-100 active:bg-gray-50"
        >
          <span className="font-medium text-sm">Edit Profile</span>
          <span className="text-gray-400 text-sm">{activeSection === "profile" ? "▲" : "▼"}</span>
        </button>
        {activeSection === "profile" && (
          <div className="px-4 py-3 space-y-3 bg-gray-50 border-b border-gray-100">
            <div className="flex justify-center py-2">
              <button onClick={() => fileInputRef.current?.click()} className="relative shrink-0">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-gray-200" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                    <span className="text-lg text-gray-400">+</span>
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 text-base bg-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm border border-gray-100 text-gray-600 font-medium">+</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleProfilePhoto} className="hidden" />
            </div>

            <div>
              <label className="text-xs text-gray-500">Nickname</label>
              <input
                type="text" maxLength={15} value={nickname}
                onChange={(e) => setNickname(sanitize(e.target.value, /[^a-zA-Z0-9_]/g))}
                className={`w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-aussie-gold ${nicknameError ? "border-red-400" : "border-gray-300"}`}
              />
              {nicknameError && <p className="text-xs text-red-400 mt-0.5">{nicknameError}</p>}
            </div>

            <div>
              <label className="text-xs text-gray-500">Region</label>
              <div className="grid grid-cols-3 gap-1.5 mt-0.5">
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRegion(region === r ? "" : r)}
                    className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      region === r
                        ? "bg-aussie-gold text-white border-aussie-gold"
                        : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500">Show region on posts</span>
                <button
                  type="button"
                  onClick={() => setShowRegion(!showRegion)}
                  className={`relative w-10 h-5.5 rounded-full transition-colors ${showRegion ? "bg-aussie-gold" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${showRegion ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">Goal</label>
              <input type="text" maxLength={100} value={goal} onChange={(e) => setGoal(sanitize(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-aussie-gold" />
            </div>

            <div>
              <label className="text-xs text-gray-500">Main Mode</label>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {FOCUS_MODES.map((m) => {
                  const isWH = m.id === "enjoying" || m.id === "challenging";
                  return (
                  <button key={m.id} onClick={() => setMainMode(m.id)}
                    className={`px-3 py-1.5 rounded-full text-xs border ${
                      mainMode === m.id
                        ? isWH ? "border-aussie-gold bg-amber-50 font-bold" : "border-ocean-blue bg-blue-50 font-bold"
                        : "border-gray-200"
                    }`}
                  >{m.description}</button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">
                {status === "in-australia" ? "Arrival Date" : "Departure Date"}
              </label>
              {status === "post-return" ? (
                <p className="text-sm text-gray-500 mt-0.5">
                  {profile.returnStartDate || "Set to today automatically when you mark as Returned."}
                </p>
              ) : (
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-aussie-gold"
                />
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500">Phase</label>
              <div className="flex gap-1.5 mt-1">
                {[
                  { value: "pre-departure", label: "Before" },
                  { value: "in-australia", label: "In AUS" },
                  { value: "post-return", label: "Returned" },
                ].map((opt) => (
                  <button key={opt.value} type="button" onClick={() => handlePhaseChange(opt.value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium border ${status === opt.value ? "border-aussie-gold bg-amber-50 font-bold" : "border-gray-200"}`}
                  >{opt.label}{status === opt.value && " ✓"}</button>
                ))}
              </div>
            </div>

            <button onClick={handleSave} disabled={saving}
              className="w-full bg-aussie-gold text-white font-bold py-2 rounded-full text-sm disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}

        {/* Notifications — Accordion */}
        <button
          onClick={() => toggle("notifications")}
          className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-100 active:bg-gray-50"
        >
          <span className="font-medium text-sm">Notifications</span>
          <span className="text-gray-400 text-sm">{activeSection === "notifications" ? "▲" : "▼"}</span>
        </button>
        {activeSection === "notifications" && (
          <div className="px-4 py-3 space-y-3 bg-gray-50 border-b border-gray-100">
            {([
              { key: "likes" as const, label: "Like notifications" },
              { key: "groupMessage" as const, label: "Group message notifications" },
              { key: "streakWarning" as const, label: "Streak warnings" },
            ]).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{label}</span>
                <button
                  type="button"
                  onClick={() => handleNotifToggle(key)}
                  className={`relative w-10 h-5.5 rounded-full transition-colors ${notifPrefs[key] ? "bg-aussie-gold" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${notifPrefs[key] ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
            ))}
            <p className="text-[10px] text-gray-400">To fully disable push notifications, use your browser settings.</p>
          </div>
        )}

        {/* Report — Accordion */}
        <button
          onClick={() => toggle("report")}
          className="w-full flex items-center justify-between px-4 py-3.5 border-b border-gray-100 active:bg-gray-50"
        >
          <span className="font-medium text-sm">Report</span>
          <span className="text-gray-400 text-sm">{activeSection === "report" ? "▲" : "▼"}</span>
        </button>
        {activeSection === "report" && (
          <div className="px-4 py-3 space-y-2 bg-gray-50 border-b border-gray-100">
            <input type="text" placeholder="Target user ID" value={reportTarget} onChange={(e) => setReportTarget(sanitize(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            <input type="text" placeholder="Reason for report" value={reportReason} onChange={(e) => setReportReason(sanitize(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            <div>
              <button onClick={() => reportFileRef.current?.click()}
                className="text-xs text-ocean-blue border border-ocean-blue px-3 py-1.5 rounded-full">
                {reportImagePreview ? "Change image" : "Attach screenshot (required)"}
              </button>
              <input ref={reportFileRef} type="file" accept="image/*" onChange={handleReportImage} className="hidden" />
              {reportImagePreview && (
                <img src={reportImagePreview} alt="" className="mt-2 w-20 h-20 object-cover rounded-lg border border-gray-200" />
              )}
            </div>
            <button onClick={handleReport} disabled={!reportTarget.trim() || !reportReason.trim() || !reportImage}
              className="text-sm bg-gray-200 text-gray-600 px-4 py-2 rounded-full disabled:opacity-50">Submit Report</button>
          </div>
        )}
      </div>

      {/* フッター直上: Legal links・Log Out・Delete Account */}
      <div className="shrink-0 border-t border-gray-100 px-4 py-4 space-y-3">
        <p className="text-center text-xs text-gray-400">
          produced by{" "}
          <a href="https://www.instagram.com/count_taku/" target="_blank" rel="noopener noreferrer" className="text-ocean-blue underline">@count_taku</a>
        </p>
        <div className="flex justify-center gap-3 text-xs flex-wrap">
          <button onClick={() => setShowTerms(true)} className="text-gray-400 underline">Terms</button>
          <button onClick={() => setShowPrivacy(true)} className="text-gray-400 underline">Privacy</button>
          <button onClick={() => setShowTokusho(true)} className="text-gray-400 underline">Legal Notice</button>
        </div>
        <button onClick={() => setShowLogoutModal(true)}
          className="w-full border border-gray-300 text-gray-600 py-2.5 rounded-full text-sm">Log Out</button>
        <button onClick={() => setShowDeleteModal(true)}
          className="w-full text-red-400 text-xs py-2">Delete Account</button>
      </div>

      {showLogoutModal && (
        <ConfirmModal
          title="Log Out"
          message="Are you sure you want to log out?"
          confirmLabel="Log Out"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      {showTokusho && <LegalNoticeModal onClose={() => setShowTokusho(false)} />}

      {showDeleteModal && (
        <ConfirmModal
          title="Delete Account"
          message="Your profile, posts, and group memberships will be permanently deleted. Communities you lead will be disbanded. Group messages will remain but show as 'Deleted Account'. This cannot be undone."
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          confirmVariant="danger"
          onConfirm={handleDeleteAccount}
          onCancel={() => !deleting && setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
