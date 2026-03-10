"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import { FOCUS_MODES, REGIONS } from "@/lib/constants";
import { isNicknameTaken } from "@/lib/validators";
import { joinOfficialGroup, leaveOfficialGroup } from "@/lib/groups";
import { uploadAvatar, deleteAccount, submitReport } from "@/lib/services/users";
import ImageCropper from "@/components/ImageCropper";
import ConfirmModal from "@/components/ConfirmModal";

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();

  const [nickname, setNickname] = useState(profile?.displayName || "");
  const [region, setRegion] = useState(profile?.region || "");
  const [goal, setGoal] = useState(profile?.goal || "");
  const [mainMode, setMainMode] = useState(profile?.mainMode || "");
  const [departureDate, setDepartureDate] = useState(profile?.departureDate || "");
  const [status, setStatus] = useState<"pre-departure" | "in-australia" | "post-return">(profile?.status || "pre-departure");
  const [saving, setSaving] = useState(false);
  const [nicknameError, setNicknameError] = useState("");
  const [activeSection, setActiveSection] = useState<"profile" | "report" | null>(null);

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

  // Logout/Delete confirmation modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
        goal: goal.trim(),
        mainMode,
        departureDate,
      });
      await refreshProfile();
      router.back();
    } catch (e) {
      console.error(e);
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
      const today = new Date();
      updates.returnStartDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
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
      console.error(e);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      await deleteAccount(user);
      router.replace("/login");
    } catch (e) {
      console.error("Account deletion failed:", e);
      alert("Deletion failed. Please log in again and try once more.");
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
      console.error(e);
    }
  };

  const toggle = (section: typeof activeSection) => {
    setActiveSection(activeSection === section ? null : section);
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
          outputSize={512}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <button onClick={() => router.back()} className="text-gray-400">←</button>
        <h1 className="text-lg font-bold">Settings</h1>
        <div className="w-8" />
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
                onChange={(e) => setNickname(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                className={`w-full border rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-aussie-gold ${nicknameError ? "border-red-400" : "border-gray-300"}`}
              />
              {nicknameError && <p className="text-xs text-red-400 mt-0.5">{nicknameError}</p>}
            </div>

            <div>
              <label className="text-xs text-gray-500">Region</label>
              <select value={region} onChange={(e) => setRegion(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-aussie-gold bg-white">
                <option value="">Select</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Goal</label>
              <input type="text" maxLength={100} value={goal} onChange={(e) => setGoal(e.target.value.replace(/[^\x20-\x7E]/g, ""))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-aussie-gold" />
            </div>

            <div>
              <label className="text-xs text-gray-500">Main Mode</label>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {FOCUS_MODES.map((m) => (
                  <button key={m.id} onClick={() => setMainMode(m.id)}
                    className={`px-3 py-1.5 rounded-full text-xs border ${mainMode === m.id ? "border-aussie-gold bg-amber-50 font-bold" : "border-gray-200"}`}
                  >{m.description}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">Departure Date</label>
              <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-aussie-gold" />
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
            <input type="text" placeholder="Target user ID" value={reportTarget} onChange={(e) => setReportTarget(e.target.value.replace(/[^\x20-\x7E]/g, ""))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            <input type="text" placeholder="Reason for report" value={reportReason} onChange={(e) => setReportReason(e.target.value.replace(/[^\x20-\x7E]/g, ""))}
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
        <div className="flex justify-center gap-4 text-xs">
          <button onClick={() => setShowPrivacy(true)} className="text-gray-400 underline">Privacy Policy</button>
          <button onClick={() => setShowTerms(true)} className="text-gray-400 underline">Terms of Service</button>
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

      {/* Privacy Policy modal */}
      {showPrivacy && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowPrivacy(false)} />
          <div className="fixed inset-4 z-50 bg-white rounded-2xl flex flex-col max-w-md mx-auto max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-sm">Privacy Policy</h3>
              <button onClick={() => setShowPrivacy(false)} className="text-gray-400 text-lg">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-xs text-gray-600 leading-relaxed space-y-3" style={{ scrollbarWidth: "none" }}>
              <p className="text-[10px] text-gray-400">Last updated: March 2026</p>
              <p className="font-bold text-sm text-gray-800">1. Information We Collect</p>
              <p>When you use Days Count in AUS ("the App"), we collect the following information:</p>
              <p>- <b>Account information:</b> Your Google account display name, email address, and profile photo provided through Google Sign-In.</p>
              <p>- <b>Profile information:</b> Nickname, region, goal, focus mode, departure/arrival dates, and profile photo you provide during onboarding and settings.</p>
              <p>- <b>User-generated content:</b> Posts (text and images), group messages, and interactions such as likes.</p>
              <p>- <b>Usage data:</b> Streak counts, XP, level progression, and activity timestamps.</p>

              <p className="font-bold text-sm text-gray-800">2. How We Use Your Information</p>
              <p>We use your information to:</p>
              <p>- Provide and operate the App's features (posting, groups, explore, streaks, leveling).</p>
              <p>- Display your profile to other users (nickname, photo, level, region, focus mode).</p>
              <p>- Calculate and track your XP, level, and streak progress.</p>
              <p>- Enable community features such as groups and the explore feed.</p>

              <p className="font-bold text-sm text-gray-800">3. Data Storage</p>
              <p>Your data is stored securely using Google Firebase (Firestore and Cloud Storage). Data is hosted on Google Cloud servers. We retain your data for as long as your account is active.</p>

              <p className="font-bold text-sm text-gray-800">4. Data Sharing</p>
              <p>We do not sell, trade, or share your personal information with third parties, except:</p>
              <p>- Public posts are visible to all App users on the Explore feed.</p>
              <p>- Profile information (nickname, level, photo, region) is visible to other users.</p>
              <p>- We may disclose information if required by law.</p>

              <p className="font-bold text-sm text-gray-800">5. Data Deletion</p>
              <p>You can delete your account at any time from Settings. This will permanently remove your profile, posts, and all associated data. This action cannot be undone.</p>

              <p className="font-bold text-sm text-gray-800">6. Children's Privacy</p>
              <p>The App is not intended for users under 13 years of age. We do not knowingly collect information from children under 13.</p>

              <p className="font-bold text-sm text-gray-800">7. Changes to This Policy</p>
              <p>We may update this Privacy Policy from time to time. Continued use of the App after changes constitutes acceptance of the updated policy.</p>

              <p className="font-bold text-sm text-gray-800">8. Contact</p>
              <p>If you have questions about this Privacy Policy, please contact us through the App's report feature.</p>
            </div>
          </div>
        </>
      )}

      {/* Terms of Service modal */}
      {showTerms && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowTerms(false)} />
          <div className="fixed inset-4 z-50 bg-white rounded-2xl flex flex-col max-w-md mx-auto max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-sm">Terms of Service</h3>
              <button onClick={() => setShowTerms(false)} className="text-gray-400 text-lg">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-xs text-gray-600 leading-relaxed space-y-3" style={{ scrollbarWidth: "none" }}>
              <p className="text-[10px] text-gray-400">Last updated: March 2026</p>
              <p className="font-bold text-sm text-gray-800">1. Acceptance of Terms</p>
              <p>By using Days Count in AUS ("the App"), you agree to these Terms of Service. If you do not agree, please do not use the App.</p>

              <p className="font-bold text-sm text-gray-800">2. Account</p>
              <p>- You must sign in with a valid Google account to use the App.</p>
              <p>- You are responsible for all activity under your account.</p>
              <p>- Nicknames must be alphanumeric (a-z, 0-9) and unique.</p>

              <p className="font-bold text-sm text-gray-800">3. User Content</p>
              <p>- You retain ownership of content you post (text and images).</p>
              <p>- By posting publicly, you grant other users the right to view your content within the App.</p>
              <p>- Posts can be edited within 5 minutes and deleted at any time.</p>

              <p className="font-bold text-sm text-gray-800">4. Prohibited Conduct</p>
              <p>You agree not to:</p>
              <p>- Post offensive, abusive, or illegal content.</p>
              <p>- Harass, bully, or threaten other users.</p>
              <p>- Impersonate other users or create fake accounts.</p>
              <p>- Attempt to manipulate XP, streaks, or levels through abuse or automation.</p>
              <p>- Use the App for commercial advertising or spam.</p>

              <p className="font-bold text-sm text-gray-800">5. Communities (Groups)</p>
              <p>- Users at Lv.5 or above can create a community.</p>
              <p>- Group leaders are responsible for their community.</p>
              <p>- Each user can join up to 2 communities (plus 1 official community).</p>
              <p>- Maximum 10 members per community.</p>

              <p className="font-bold text-sm text-gray-800">6. Termination</p>
              <p>We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time from Settings.</p>

              <p className="font-bold text-sm text-gray-800">7. Disclaimer</p>
              <p>The App is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free operation.</p>

              <p className="font-bold text-sm text-gray-800">8. Limitation of Liability</p>
              <p>To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, or consequential damages arising from your use of the App.</p>

              <p className="font-bold text-sm text-gray-800">9. Changes to Terms</p>
              <p>We may update these Terms from time to time. Continued use of the App after changes constitutes acceptance.</p>

              <p className="font-bold text-sm text-gray-800">10. Contact</p>
              <p>If you have questions about these Terms, please contact us through the App's report feature.</p>
            </div>
          </div>
        </>
      )}

      {showDeleteModal && (
        <ConfirmModal
          title="Delete Account"
          message="All data will be permanently lost. Are you sure?"
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
