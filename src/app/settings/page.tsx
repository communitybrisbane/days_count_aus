"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import { MAIN_MODE_OPTIONS, REGIONS, AVATAR_SIZE, NICKNAME_MAX, GOAL_MAX } from "@/lib/constants";
import { getTodayStr } from "@/lib/utils";
import { isNicknameTaken } from "@/lib/validators";
import { joinOfficialGroup, leaveOfficialGroup } from "@/lib/groups";
import { uploadAvatar, deleteAccount, submitReport, fetchNotificationPrefs, updateNotificationPrefs, unblockUser } from "@/lib/services/users";
import type { NotificationPrefs } from "@/types";
import ImageCropper from "@/components/ImageCropper";
import ConfirmModal from "@/components/ConfirmModal";
import { TermsModal, PrivacyModal, LegalNoticeModal } from "@/components/LegalModals";
import AsciiWarn from "@/components/AsciiWarn";
import { useAsciiInput } from "@/hooks/useAsciiInput";

export default function SettingsPage() {
  const { user, profile, privateData, refreshProfile } = useAuth();
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
  const [activeSection, setActiveSection] = useState<"profile" | "notifications" | "blocked" | "report" | null>(null);
  const [blockedProfiles, setBlockedProfiles] = useState<{ uid: string; displayName: string }[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
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

  // Sync form state when profile loads
  useEffect(() => {
    if (!profile) return;
    setNickname(profile.displayName || "");
    setRegion(profile.region || "");
    setGoal(profile.goal || "");
    setMainMode(profile.mainMode || "");
    setDepartureDate(profile.departureDate || "");
    setStatus(profile.status || "pre-departure");
    setShowRegion(profile.showRegion !== false);
  }, [profile]);

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
        displayNameLower: nickname.trim().toLowerCase(),
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

  const [reportError, setReportError] = useState("");

  const handleReport = async () => {
    if (!user || !reportTarget.trim() || !reportReason.trim() || !reportImage) return;
    setReportError("");
    try {
      // Resolve username to UID (case-insensitive)
      const q = query(collection(db, "users"), where("displayNameLower", "==", reportTarget.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setReportError("User not found");
        return;
      }
      const targetUid = snap.docs[0].id;
      await submitReport(user.uid, targetUid, reportReason.trim(), reportImage);
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
    if (section === "blocked" && activeSection !== "blocked") {
      loadBlockedProfiles();
    }
  };

  const loadBlockedProfiles = async () => {
    const blockedIds = privateData?.blockedUsers || [];
    if (blockedIds.length === 0) { setBlockedProfiles([]); return; }
    setLoadingBlocked(true);
    const profiles: { uid: string; displayName: string }[] = [];
    for (const uid of blockedIds) {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        profiles.push({ uid, displayName: snap.exists() ? snap.data().displayName || "Unknown" : "Deleted Account" });
      } catch {
        profiles.push({ uid, displayName: "Unknown" });
      }
    }
    setBlockedProfiles(profiles);
    setLoadingBlocked(false);
  };

  const handleUnblock = async (targetUid: string) => {
    if (!user) return;
    await unblockUser(user.uid, targetUid);
    setBlockedProfiles((prev) => prev.filter((p) => p.uid !== targetUid));
    await refreshProfile();
  };

  if (!profile) return null;

  return (
    <div className="min-h-dvh flex flex-col">
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropSrc("")}
          cropShape="round"
          outputSize={AVATAR_SIZE}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-forest-light/20 bg-forest/95 backdrop-blur-md" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center text-white/40 text-xl -ml-2">←</button>
        <h1 className="text-lg font-bold text-white/90">Settings</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {/* Profile Edit — Accordion */}
        <button
          onClick={() => toggle("profile")}
          className="w-full flex items-center justify-between px-4 py-3.5 border-b border-forest-light/15 active:bg-forest-light/10"
        >
          <span className="font-medium text-sm text-white/80">Edit Profile</span>
          <span className="text-white/30 text-sm">{activeSection === "profile" ? "▲" : "▼"}</span>
        </button>
        {activeSection === "profile" && (
          <div className="px-4 py-3 space-y-3 bg-forest-light/10 border-b border-forest-light/15">
            <div className="flex justify-center py-2">
              <button onClick={() => fileInputRef.current?.click()} className="relative shrink-0">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white/20" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-forest-light/20 flex items-center justify-center border-2 border-dashed border-white/30">
                    <span className="text-lg text-white/40">+</span>
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 text-base bg-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm border border-gray-100 text-gray-600 font-medium">+</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleProfilePhoto} className="hidden" />
            </div>

            <div>
              <label className="text-xs text-white/60">Nickname</label>
              <input
                type="text" maxLength={NICKNAME_MAX} value={nickname}
                onChange={(e) => setNickname(sanitize(e.target.value, /[^a-zA-Z0-9_]/g))}
                className={`w-full border rounded-lg px-3 py-2 text-sm mt-0.5 bg-forest-light/10 text-white focus:outline-none focus:ring-2 focus:ring-accent-orange ${nicknameError ? "border-red-400" : "border-forest-light/30"}`}
              />
              <AsciiWarn show={showWarn} />
              {nicknameError && <p className="text-xs text-red-400 mt-0.5">{nicknameError}</p>}
            </div>

            <div>
              <label className="text-xs text-white/60">Region</label>
              <div className="grid grid-cols-3 gap-1.5 mt-0.5">
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRegion(region === r ? "" : r)}
                    className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      region === r
                        ? "bg-accent-orange text-white border-accent-orange"
                        : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-white/60">Show region on posts</span>
                <button
                  type="button"
                  onClick={() => setShowRegion(!showRegion)}
                  className={`relative w-10 h-5.5 rounded-full transition-colors ${showRegion ? "bg-accent-orange" : "bg-forest-light/30"}`}
                >
                  <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${showRegion ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60">Goal</label>
              <input type="text" maxLength={GOAL_MAX} value={goal} onChange={(e) => setGoal(sanitize(e.target.value))}
                className="w-full border border-forest-light/30 bg-forest-light/10 text-white rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-accent-orange" />
            </div>

            <div>
              <label className="text-xs text-white/60">Main Mode</label>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {MAIN_MODE_OPTIONS.map((m) => (
                  <button key={m.id} onClick={() => setMainMode(m.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                      mainMode === m.id
                        ? "bg-accent-orange text-white font-bold"
                        : "bg-white text-forest-mid"
                    }`}
                  >{m.label}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60">
                {status === "in-australia" ? "Arrival Date" : "Departure Date"}
              </label>
              {status === "post-return" ? (
                <p className="text-sm text-white/60 mt-0.5">
                  {profile.returnStartDate || "Set to today automatically when you mark as Returned."}
                </p>
              ) : (
                <input
                  type="date"
                  lang="en"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full border border-forest-light/30 bg-forest-light/10 text-white rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-accent-orange"
                />
              )}
            </div>

            <div>
              <label className="text-xs text-white/60">Phase</label>
              <div className="flex gap-1.5 mt-1">
                {[
                  { value: "pre-departure", label: "Before" },
                  { value: "in-australia", label: "In AUS" },
                  { value: "post-return", label: "Returned" },
                ].map((opt) => (
                  <button key={opt.value} type="button" onClick={() => handlePhaseChange(opt.value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium ${status === opt.value ? "bg-accent-orange text-white font-bold" : "bg-white text-forest-mid"}`}
                  >{opt.label}{status === opt.value && " ✓"}</button>
                ))}
              </div>
            </div>

            <button onClick={handleSave} disabled={saving}
              className="w-full bg-accent-orange text-white font-bold py-2 rounded-full text-sm disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}

        {/* Notifications — Accordion */}
        <button
          onClick={() => toggle("notifications")}
          className="w-full flex items-center justify-between px-4 py-3.5 border-b border-forest-light/15 active:bg-forest-light/10"
        >
          <span className="font-medium text-sm text-white/80">Notifications</span>
          <span className="text-white/30 text-sm">{activeSection === "notifications" ? "▲" : "▼"}</span>
        </button>
        {activeSection === "notifications" && (
          <div className="px-4 py-3 space-y-3 bg-forest-light/10 border-b border-forest-light/15">
            {([
              { key: "likes" as const, label: "Like notifications" },
              { key: "groupMessage" as const, label: "Group message notifications" },
              { key: "streakWarning" as const, label: "Streak warnings" },
            ]).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-white/80">{label}</span>
                <button
                  type="button"
                  onClick={() => handleNotifToggle(key)}
                  className={`relative w-10 h-5.5 rounded-full transition-colors ${notifPrefs[key] ? "bg-accent-orange" : "bg-forest-light/30"}`}
                >
                  <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${notifPrefs[key] ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
            ))}
            <p className="text-[10px] text-white/40">To fully disable push notifications, use your browser settings.</p>
          </div>
        )}

        {/* Blocked Users — Accordion */}
        <button
          onClick={() => toggle("blocked")}
          className="w-full flex items-center justify-between px-4 py-3.5 border-b border-forest-light/15 active:bg-forest-light/10"
        >
          <span className="font-medium text-sm text-white/80">Blocked Users</span>
          <span className="text-white/30 text-sm">{activeSection === "blocked" ? "▲" : "▼"}</span>
        </button>
        {activeSection === "blocked" && (
          <div className="px-4 py-3 bg-forest-light/10 border-b border-forest-light/15">
            {loadingBlocked ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent-orange" />
              </div>
            ) : blockedProfiles.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-2">No blocked users</p>
            ) : (
              <div className="space-y-2">
                {blockedProfiles.map((bp) => (
                  <div key={bp.uid} className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5">
                    <span className="text-sm text-gray-700 truncate flex-1">{bp.displayName}</span>
                    <button
                      onClick={() => handleUnblock(bp.uid)}
                      className="text-xs text-red-400 border border-red-200 px-3 py-1 rounded-full shrink-0 ml-2"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Report — Accordion */}
        <button
          onClick={() => toggle("report")}
          className="w-full flex items-center justify-between px-4 py-3.5 border-b border-forest-light/15 active:bg-forest-light/10"
        >
          <span className="font-medium text-sm text-white/80">Report</span>
          <span className="text-white/30 text-sm">{activeSection === "report" ? "▲" : "▼"}</span>
        </button>
        {activeSection === "report" && (
          <div className="px-4 py-3 space-y-2 bg-forest-light/10 border-b border-forest-light/15">
            <input type="text" placeholder="Username" value={reportTarget} onChange={(e) => { setReportTarget(sanitize(e.target.value)); setReportError(""); }}
              className="w-full border border-forest-light/30 bg-forest-light/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none placeholder-white/30" />
            {reportError && <p className="text-xs text-red-400">{reportError}</p>}
            <input type="text" placeholder="Reason for report" value={reportReason} onChange={(e) => setReportReason(sanitize(e.target.value))}
              className="w-full border border-forest-light/30 bg-forest-light/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none placeholder-white/30" />
            <div>
              <button onClick={() => reportFileRef.current?.click()}
                className="text-xs text-forest-mid border border-forest-mid px-3 py-1.5 rounded-full">
                {reportImagePreview ? "Change image" : "Attach screenshot (required)"}
              </button>
              <input ref={reportFileRef} type="file" accept="image/*" onChange={handleReportImage} className="hidden" />
              {reportImagePreview && (
                <img src={reportImagePreview} alt="" className="mt-2 w-20 h-20 object-cover rounded-lg border border-forest-light/30" />
              )}
            </div>
            <button onClick={handleReport} disabled={!reportTarget.trim() || !reportReason.trim() || !reportImage}
              className="text-sm bg-forest-light/20 text-white/80 px-4 py-2 rounded-full disabled:opacity-50">Submit Report</button>
          </div>
        )}
      </div>

      {/* フッター直上: Legal links・Log Out・Delete Account */}
      <div className="shrink-0 border-t border-forest-light/15 px-4 py-4 space-y-3">
        <p className="text-center text-xs text-white/30">
          produced by{" "}
          <a href="https://www.instagram.com/count_taku/" target="_blank" rel="noopener noreferrer" className="text-accent-orange underline">@count_taku</a>
        </p>
        <div className="flex justify-center gap-3 text-xs flex-wrap">
          <button onClick={() => setShowTerms(true)} className="text-white/30 underline">Terms</button>
          <button onClick={() => setShowPrivacy(true)} className="text-white/30 underline">Privacy</button>
          <button onClick={() => setShowTokusho(true)} className="text-white/30 underline">Legal Notice</button>
        </div>
        <button onClick={() => setShowLogoutModal(true)}
          className="w-full border border-forest-light/30 text-white/60 py-2.5 rounded-full text-sm">Log Out</button>
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
