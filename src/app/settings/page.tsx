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
  const [showTokusho, setShowTokusho] = useState(false);

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
      console.error(e);
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
                onChange={(e) => setNickname(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
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
              <p>By using Days Count in AUS (&quot;the App&quot;), you agree to these Terms of Service. If you do not agree, please do not use the App.</p>

              <p className="font-bold text-sm text-gray-800">2. Service Overview</p>
              <p>The App is a free progressive web application (PWA) designed to help working holiday participants in Australia track their daily experiences, growth, and community engagement. All features are provided at no charge.</p>

              <p className="font-bold text-sm text-gray-800">3. Account Registration</p>
              <p>- You must sign in with a valid Google account.</p>
              <p>- One account per person. Multiple accounts are not permitted.</p>
              <p>- You are responsible for all activity under your account.</p>
              <p>- Nicknames must be alphanumeric (a-z, 0-9), 1-15 characters, and unique.</p>
              <p>- You must be at least 13 years old to use this App.</p>

              <p className="font-bold text-sm text-gray-800">4. User Content</p>
              <p>- You retain ownership of content you post (text and images).</p>
              <p>- By posting publicly, you grant other App users a non-exclusive, royalty-free right to view your content within the App.</p>
              <p>- Posts can be edited within 5 minutes of creation and deleted at any time.</p>
              <p>- Private posts are visible only to you.</p>
              <p>- Uploaded images are automatically compressed and stripped of EXIF metadata (including location data) for privacy.</p>

              <p className="font-bold text-sm text-gray-800">5. Prohibited Conduct</p>
              <p>You agree not to:</p>
              <p>- Post offensive, abusive, defamatory, or illegal content.</p>
              <p>- Harass, bully, or threaten other users.</p>
              <p>- Impersonate other users or create fake accounts.</p>
              <p>- Attempt to manipulate XP, streaks, or levels through abuse, automation, or exploiting bugs.</p>
              <p>- Access or modify the database, API, or other systems beyond normal App usage.</p>
              <p>- Use the App for commercial advertising, spam, or solicitation.</p>
              <p>- Scrape, crawl, or systematically collect data from the App.</p>

              <p className="font-bold text-sm text-gray-800">6. Content Moderation</p>
              <p>- Posts are automatically screened for prohibited content. Violating posts may be hidden without prior notice.</p>
              <p>- Users can report posts and other users. Posts receiving 3 or more reports are automatically hidden for review.</p>
              <p>- Hidden posts older than 30 days may be permanently deleted.</p>

              <p className="font-bold text-sm text-gray-800">7. Communities (Groups)</p>
              <p>- Users at Lv.5 or above can join communities. Users at Lv.5 or above can create communities.</p>
              <p>- Each user can join up to 2 communities (plus official communities).</p>
              <p>- Maximum 10 members per community.</p>
              <p>- Group leaders are responsible for managing their community. If a leader leaves, the community is disbanded.</p>
              <p>- Messages are limited to 100 characters.</p>

              <p className="font-bold text-sm text-gray-800">8. XP, Levels, and Streaks</p>
              <p>- XP is earned through posting and receiving likes. XP and levels have no monetary value.</p>
              <p>- Streaks reset after 48 hours of inactivity. A warning notification is sent 6 hours before expiry (if notifications are enabled).</p>
              <p>- Daily like limit: 5 likes per day.</p>

              <p className="font-bold text-sm text-gray-800">9. Push Notifications</p>
              <p>- Push notifications are optional. You may enable or disable them at any time through your browser settings.</p>
              <p>- Notifications are used solely for streak warnings and App-related alerts.</p>

              <p className="font-bold text-sm text-gray-800">10. Blocking and Reporting</p>
              <p>- You can block any user. Blocked users&apos; posts will not appear in your feed.</p>
              <p>- Reports require a reason and screenshot. False reporting may result in account suspension.</p>

              <p className="font-bold text-sm text-gray-800">11. Termination</p>
              <p>- We reserve the right to suspend or terminate accounts that violate these terms without prior notice.</p>
              <p>- You may delete your account at any time from Settings. Deletion is permanent and cannot be undone.</p>

              <p className="font-bold text-sm text-gray-800">12. Disclaimer</p>
              <p>The App is provided &quot;as is&quot; without warranties of any kind, express or implied. We do not guarantee uninterrupted, error-free, or secure operation. We are not responsible for any data loss due to system failures.</p>

              <p className="font-bold text-sm text-gray-800">13. Limitation of Liability</p>
              <p>To the maximum extent permitted by law, the operator shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of or inability to use the App.</p>

              <p className="font-bold text-sm text-gray-800">14. Governing Law</p>
              <p>These Terms shall be governed by and construed in accordance with the laws of Japan. Any disputes shall be subject to the exclusive jurisdiction of the Fukuoka District Court.</p>

              <p className="font-bold text-sm text-gray-800">15. Changes to Terms</p>
              <p>We may update these Terms from time to time. Material changes will be communicated through the App. Continued use after changes constitutes acceptance.</p>

              <p className="font-bold text-sm text-gray-800">16. Contact</p>
              <p>For inquiries, please contact us via Instagram: <b>@count_taku</b></p>
            </div>
          </div>
        </>
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

              <p className="font-bold text-sm text-gray-800">1. Operator</p>
              <p>Days Count in AUS (&quot;the App&quot;) is operated by @count_taku (hereinafter &quot;the Operator&quot;).</p>

              <p className="font-bold text-sm text-gray-800">2. Information We Collect</p>
              <p>We collect the following categories of information:</p>
              <p><b>a) Account information (from Google Sign-In):</b></p>
              <p>- Google account UID (unique identifier)</p>
              <p>- Display name and profile photo (used as default, replaceable)</p>
              <p>Note: We do not store your email address or Google password.</p>
              <p><b>b) Profile information you provide:</b></p>
              <p>- Nickname, region, goal, focus mode, departure/arrival dates, profile photo</p>
              <p><b>c) User-generated content:</b></p>
              <p>- Posts (text up to 500 characters, images up to 5MB)</p>
              <p>- Group messages (up to 100 characters), message reactions</p>
              <p>- Likes, follows, blocks, and reports</p>
              <p><b>d) Automatically collected data:</b></p>
              <p>- XP, level, streak count, activity timestamps</p>
              <p>- Push notification token (if you enable notifications)</p>
              <p>- Basic usage analytics via Firebase Analytics (page views, session duration, device type)</p>

              <p className="font-bold text-sm text-gray-800">3. How We Use Your Information</p>
              <p>- Provide and operate the App&apos;s features (posting, groups, explore, streaks, leveling)</p>
              <p>- Display your public profile to other users (nickname, photo, level, region, focus mode)</p>
              <p>- Calculate XP, level, and streak progress</p>
              <p>- Send push notifications (streak warnings, only if enabled)</p>
              <p>- Moderate content and enforce community guidelines</p>
              <p>- Improve the App based on aggregated usage analytics</p>

              <p className="font-bold text-sm text-gray-800">4. Image Processing</p>
              <p>All uploaded images are processed client-side before upload:</p>
              <p>- Resized to appropriate dimensions (max 1024px for posts, 512px for avatars, 256px for group icons)</p>
              <p>- Compressed to JPEG format</p>
              <p>- <b>EXIF metadata is automatically stripped</b>, including GPS location, camera information, and timestamps. This protects your location privacy.</p>

              <p className="font-bold text-sm text-gray-800">5. Data Storage and Security</p>
              <p>- All data is stored on Google Cloud Platform via Firebase (Firestore and Cloud Storage)</p>
              <p>- Data is protected by Firebase Security Rules that restrict access per user role</p>
              <p>- Sensitive data (push notification tokens, blocked user lists) is stored in a separate private subcollection accessible only to the account owner</p>
              <p>- The App is hosted on Vercel</p>
              <p>- We retain your data for as long as your account is active</p>

              <p className="font-bold text-sm text-gray-800">6. Data Sharing</p>
              <p>We do <b>not</b> sell, trade, or share your personal information with third parties, except:</p>
              <p>- Public posts and profile information (nickname, photo, level, region) are visible to other App users</p>
              <p>- Private posts are visible only to the account owner</p>
              <p>- Firebase Analytics data is processed by Google (aggregated, not personally identifiable)</p>
              <p>- We may disclose information if required by applicable law</p>

              <p className="font-bold text-sm text-gray-800">7. Third-Party Services</p>
              <p>The App uses the following third-party services:</p>
              <p>- <b>Google Firebase:</b> Authentication, database, file storage, push notifications, analytics</p>
              <p>- <b>Vercel:</b> App hosting and deployment</p>
              <p>No advertising networks, tracking pixels, or other third-party analytics are used.</p>

              <p className="font-bold text-sm text-gray-800">8. Your Rights</p>
              <p>- <b>Access:</b> You can view all your data within the App (profile, posts, groups)</p>
              <p>- <b>Correction:</b> You can edit your profile and posts at any time</p>
              <p>- <b>Deletion:</b> You can delete your account from Settings. This permanently removes all your data (profile, posts, group memberships, images). This cannot be undone.</p>
              <p>- <b>Notification opt-out:</b> You can disable push notifications through your browser settings at any time</p>

              <p className="font-bold text-sm text-gray-800">9. Children&apos;s Privacy</p>
              <p>The App is not intended for users under 13 years of age. We do not knowingly collect information from children under 13. If we learn that we have collected data from a child under 13, we will promptly delete the account.</p>

              <p className="font-bold text-sm text-gray-800">10. Data Breach</p>
              <p>In the event of a data breach that may affect your personal information, we will notify affected users through the App as soon as reasonably possible.</p>

              <p className="font-bold text-sm text-gray-800">11. Changes to This Policy</p>
              <p>We may update this Privacy Policy from time to time. Material changes will be communicated through the App. Continued use after changes constitutes acceptance.</p>

              <p className="font-bold text-sm text-gray-800">12. Contact</p>
              <p>For privacy-related inquiries, please contact us via Instagram: <b>@count_taku</b></p>
            </div>
          </div>
        </>
      )}

      {/* Legal Notice (特定商取引法に基づく表記) modal */}
      {showTokusho && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowTokusho(false)} />
          <div className="fixed inset-4 z-50 bg-white rounded-2xl flex flex-col max-w-md mx-auto max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-sm">Legal Notice</h3>
              <button onClick={() => setShowTokusho(false)} className="text-gray-400 text-lg">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-xs text-gray-600 leading-relaxed space-y-3" style={{ scrollbarWidth: "none" }}>
              <p className="text-[10px] text-gray-400">Last updated: March 2026</p>
              <p className="font-bold text-sm text-gray-800">Disclosure under the Act on Specified Commercial Transactions</p>
              <p className="font-bold text-xs text-gray-700">(特定商取引法に基づく表記)</p>

              <table className="w-full border-collapse mt-2">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">Service name</td>
                    <td className="py-2 text-gray-600">Days Count in AUS</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">Operator</td>
                    <td className="py-2 text-gray-600">@count_taku (individual operator)</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">Address</td>
                    <td className="py-2 text-gray-600">Disclosed upon request to the contact below</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">Contact</td>
                    <td className="py-2 text-gray-600">Instagram: @count_taku</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">Price</td>
                    <td className="py-2 text-gray-600">Free (all features are provided at no charge)</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">Additional fees</td>
                    <td className="py-2 text-gray-600">Internet connection fees are borne by the user</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">Payment method</td>
                    <td className="py-2 text-gray-600">Not applicable (free service)</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">Delivery</td>
                    <td className="py-2 text-gray-600">Available immediately upon account creation via web browser</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">Cancellation / Refund</td>
                    <td className="py-2 text-gray-600">You may delete your account at any time from Settings. As the service is free, no refund applies.</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">Operating environment</td>
                    <td className="py-2 text-gray-600">Modern web browsers (Chrome, Safari, Edge, Firefox) with JavaScript enabled. PWA installation supported.</td>
                  </tr>
                </tbody>
              </table>

              <p className="font-bold text-sm text-gray-800 mt-4">Japanese (日本語)</p>
              <table className="w-full border-collapse mt-2">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">サービス名</td>
                    <td className="py-2 text-gray-600">Days Count in AUS</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">運営者</td>
                    <td className="py-2 text-gray-600">@count_taku（個人運営）</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">所在地</td>
                    <td className="py-2 text-gray-600">請求があった場合に遅滞なく開示いたします</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">連絡先</td>
                    <td className="py-2 text-gray-600">Instagram: @count_taku</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">販売価格</td>
                    <td className="py-2 text-gray-600">無料（全機能を無償で提供）</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">サービス以外の必要料金</td>
                    <td className="py-2 text-gray-600">インターネット接続料金はお客様のご負担となります</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">支払方法</td>
                    <td className="py-2 text-gray-600">該当なし（無料サービス）</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">提供時期</td>
                    <td className="py-2 text-gray-600">アカウント作成後、Webブラウザより即時ご利用いただけます</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">解約・返金</td>
                    <td className="py-2 text-gray-600">設定画面よりいつでもアカウントを削除できます。無料サービスのため返金はございません。</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">動作環境</td>
                    <td className="py-2 text-gray-600">JavaScript対応のモダンブラウザ（Chrome, Safari, Edge, Firefox）。PWAインストール対応。</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

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
