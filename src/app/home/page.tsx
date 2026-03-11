"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { getDayCount, formatDayCount, calculateLevel, levelProgress, xpForLevel, getTodayStr } from "@/lib/utils";
import { fetchTotalLikesAndWeekly } from "@/lib/services/posts";
import { fetchAdminConfig, saveFCMToken } from "@/lib/services/users";
import { requestFCMToken, onFCMMessage } from "@/lib/fcm";
import BottomNav from "@/components/layout/BottomNav";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmModal from "@/components/ConfirmModal";
import MilestoneAnimation from "@/components/MilestoneAnimation";
import BannerCarousel from "@/components/BannerCarousel";
import { MILESTONES } from "@/lib/constants";
import { IconEdit } from "@/components/icons";

interface ZoomSchedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface AdminConfig {
  message: string;
  bannerImageUrl?: string;
  zoomUrl?: string;
  zoomLabel?: string;
  zoomSchedules?: ZoomSchedule[];
  zoomNextInfo?: string;
}

const STATUS_LABELS: Record<string, string> = {
  "pre-departure": "Before departure",
  "in-australia": "In Australia",
  "post-return": "After return",
};

export default function HomePage() {
  const { user, profile, loading } = useAuthGuard();
  const { refreshProfile } = useAuth();
  const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);
  const [weeklyPostCount, setWeeklyPostCount] = useState(0);
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneDay, setMilestoneDay] = useState(0);
  const [phasePrompt, setPhasePrompt] = useState<{ message: string; newStatus: string } | null>(null);
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [goalDraft, setGoalDraft] = useState(3);
  const [goalTextDraft, setGoalTextDraft] = useState("");

  // createdAt: Firestore Timestamp → Date
  const createdAtDate = useMemo(() => {
    const ca = profile?.createdAt as { toDate?: () => Date } | undefined;
    return ca?.toDate?.() ?? null;
  }, [profile]);

  const dayCount = useMemo(() => {
    if (!profile) return { label: "D", number: 0 };
    return getDayCount(profile.status || "pre-departure", profile.departureDate || "", profile.returnStartDate, createdAtDate);
  }, [profile, createdAtDate]);

  const dayCountStr = formatDayCount(dayCount.label, dayCount.number);
  const level = profile ? calculateLevel(profile.totalXP) : 1;
  const progress = profile ? levelProgress(profile.totalXP) : 0;

  const weeklyGoal = profile?.weeklyGoal || 0;

  // Fetch admin config
  useEffect(() => {
    if (!user) return;
    fetchAdminConfig().then((data) => {
      if (data) setAdminConfig(data as AdminConfig);
    }).catch((e) => console.error("Failed to fetch admin config:", e));
  }, [user]);

  // Zoom schedule check (every 30s)
  const checkZoomOpen = useCallback(() => {
    if (!adminConfig?.zoomSchedules?.length) { setZoomOpen(false); return; }
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const isOpen = adminConfig.zoomSchedules.some(
      (s) => s.dayOfWeek === now.getDay() && hhmm >= s.startTime && hhmm < s.endTime
    );
    setZoomOpen(isOpen);
  }, [adminConfig]);

  useEffect(() => {
    checkZoomOpen();
    const timer = setInterval(checkZoomOpen, 30_000);
    return () => clearInterval(timer);
  }, [checkZoomOpen]);

  // Fetch weekly stats
  useEffect(() => {
    if (!user || !profile) return;
    fetchTotalLikesAndWeekly(user.uid).then(({ weeklyPostCount: count }) => {
      setWeeklyPostCount(count);
    }).catch(console.error);
  }, [user, profile]);

  // Milestone check
  useEffect(() => {
    if (!profile || dayCount.label !== "D" || dayCount.number <= 0) return;
    const milestone = MILESTONES.find((m) => m === dayCount.number);
    if (!milestone) return;
    const key = `milestone_${milestone}_shown`;
    if (localStorage.getItem(key)) return;
    setMilestoneDay(milestone);
    setShowMilestone(true);
    localStorage.setItem(key, "true");
  }, [dayCount, profile]);

  // FCM: check permission & register token
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      if (!localStorage.getItem("notif_banner_dismissed")) setShowNotifBanner(true);
    } else if (Notification.permission === "granted") {
      requestFCMToken().then((token) => { if (token) saveFCMToken(user.uid, token); });
    }
  }, [user]);

  // FCM: foreground message listener
  useEffect(() => {
    if (!user) return;
    return onFCMMessage((payload: unknown) => {
      const p = payload as { notification?: { title?: string; body?: string } };
      if (p.notification?.title) alert(`${p.notification.title}\n${p.notification.body || ""}`);
    });
  }, [user]);

  // Phase auto-transition check
  useEffect(() => {
    if (!profile?.departureDate) return;
    const today = new Date().toISOString().slice(0, 10);
    const sessionKey = `phase_prompt_dismissed_${profile.status}`;
    if (sessionStorage.getItem(sessionKey)) return;

    if (profile.status === "pre-departure" && today >= profile.departureDate) {
      setPhasePrompt({ message: "Your departure date has passed. Start your working holiday?", newStatus: "in-australia" });
    } else if (profile.status === "in-australia" && dayCount.number >= 365) {
      setPhasePrompt({ message: "You've been in Australia for over 365 days. Switch to post-return?", newStatus: "post-return" });
    }
  }, [profile, dayCount]);

  const handleEnableNotifications = async () => {
    if (!user) return;
    const token = await requestFCMToken();
    if (token) await saveFCMToken(user.uid, token);
    setShowNotifBanner(false);
    localStorage.setItem("notif_banner_dismissed", "true");
  };

  const dismissNotifBanner = () => {
    setShowNotifBanner(false);
    localStorage.setItem("notif_banner_dismissed", "true");
  };

  const handlePhaseTransition = async () => {
    if (!user || !phasePrompt) return;
    const updates: Record<string, unknown> = { status: phasePrompt.newStatus };
    if (phasePrompt.newStatus === "post-return") {
      updates.returnStartDate = getTodayStr();
    }
    await updateDoc(doc(db, "users", user.uid), updates);
    await refreshProfile();
    setPhasePrompt(null);
  };

  const dismissPhasePrompt = () => {
    if (profile) sessionStorage.setItem(`phase_prompt_dismissed_${profile.status}`, "true");
    setPhasePrompt(null);
  };

  const handleSaveGoal = async () => {
    if (!user) return;
    const value = Math.max(1, Math.min(goalDraft, 30));
    await updateDoc(doc(db, "users", user.uid), { weeklyGoal: value, goal: goalTextDraft.trim() });
    await refreshProfile();
    setShowGoalInput(false);
  };

  const openGoalInput = () => {
    setGoalDraft(weeklyGoal || 3);
    setGoalTextDraft(profile?.goal || "");
    setShowGoalInput(true);
  };

  if (loading || !profile) return <LoadingSpinner fullScreen />;

  const goalCleared = weeklyGoal > 0 && weeklyPostCount >= weeklyGoal;

  return (
    <div className="pb-16 flex flex-col min-h-dvh">
      <MilestoneAnimation dayNumber={milestoneDay} show={showMilestone} onClose={() => setShowMilestone(false)} />

      {phasePrompt && (
        <ConfirmModal
          title="Phase Transition"
          message={phasePrompt.message}
          confirmLabel="Yes, switch"
          onConfirm={handlePhaseTransition}
          onCancel={dismissPhasePrompt}
        />
      )}

      {/* Notification permission banner */}
      {showNotifBanner && (
        <div className="mx-5 mt-3 bg-ocean-blue/10 border border-ocean-blue/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800">Enable notifications</p>
            <p className="text-xs text-gray-500">Get streak warnings before you lose your progress</p>
          </div>
          <button onClick={handleEnableNotifications} className="px-3 py-1.5 bg-ocean-blue text-white text-xs font-bold rounded-lg shrink-0">
            Enable
          </button>
          <button onClick={dismissNotifBanner} className="text-gray-400 text-lg leading-none">×</button>
        </div>
      )}

      {/* ===== 1. Gold Header & Life Bar ===== */}
      <div className="bg-gradient-to-br from-aussie-gold to-amber-500 text-white pt-7 pb-6 px-6 rounded-b-3xl">
        <p className="text-xs opacity-80 mb-1">{STATUS_LABELS[profile.status || "pre-departure"] ?? profile.status}</p>
        <div className="flex items-end justify-between mb-0.5">
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-1.5">
            {dayCountStr}
            {(profile.currentStreak ?? 0) > 0 && <span className="text-2xl">🔥</span>}
          </h1>
          <p className="text-2xl font-black opacity-90 leading-none mb-0.5">Lv.{level}</p>
        </div>
        <p className="text-xs opacity-80 mb-3">Hello, {profile.displayName}!</p>

        {/* XP Progress Bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/20 rounded-full h-2">
            <div className="bg-white h-2 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <span className="text-[10px] opacity-70 shrink-0">{profile.totalXP - xpForLevel(level)} / {xpForLevel(level + 1) - xpForLevel(level)} EXP</span>
        </div>
      </div>

      {/* ===== 2. Weekly Goal Section ===== */}
      <div className="px-5 -mt-4">
        <div className={`rounded-2xl shadow-md px-4 py-3 relative overflow-hidden transition-all duration-500 ${
          goalCleared
            ? "bg-gradient-to-br from-amber-50 to-yellow-50 ring-2 ring-aussie-gold/60 shadow-lg shadow-aussie-gold/20"
            : "bg-white"
        }`}>
          {/* Goal Achieved badge */}
          {goalCleared && (
            <div className="absolute top-2 right-2 bg-gradient-to-r from-aussie-gold to-amber-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-bounce shadow-md">
              Goal Achieved!
            </div>
          )}

          <div className="flex items-center justify-between mb-1">
            <p className={`text-[10px] ${goalCleared ? "text-aussie-gold font-bold" : "text-gray-400"}`}>My Weekly Goal</p>
            <button onClick={openGoalInput} className={`p-0.5 ${goalCleared ? "text-aussie-gold" : "text-gray-400"}`}>
              <IconEdit size={14} />
            </button>
          </div>

          {profile.goal ? (
            <p className="text-sm font-bold text-gray-800 mb-2 leading-snug">{profile.goal}</p>
          ) : (
            <button onClick={openGoalInput} className="text-sm text-ocean-blue font-bold mb-2">Set your goal</button>
          )}

          {weeklyGoal > 0 ? (
            <>
              <div className="flex items-end gap-1 mb-1.5">
                <span className={`text-2xl font-black ${goalCleared ? "text-aussie-gold" : "text-ocean-blue"}`}>
                  {weeklyPostCount}
                </span>
                <span className="text-sm text-gray-400 mb-0.5">/ {weeklyGoal} posts</span>
                {goalCleared && <span className="text-sm ml-1">🏆</span>}
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ${goalCleared ? "bg-gradient-to-r from-aussie-gold to-amber-400" : "bg-ocean-blue"}`}
                  style={{ width: `${Math.min((weeklyPostCount / weeklyGoal) * 100, 100)}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400">Set a weekly posting goal to track your progress!</p>
          )}
        </div>
      </div>

      {/* Goal input modal */}
      {showGoalInput && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-8" onClick={() => setShowGoalInput(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-gray-800 mb-3">My Weekly Goal</p>

            {/* Goal text */}
            <label className="text-xs text-gray-500">Goal</label>
            <input
              type="text"
              maxLength={100}
              value={goalTextDraft}
              onChange={(e) => setGoalTextDraft(e.target.value.replace(/[^\x20-\x7E]/g, ""))}
              placeholder="e.g. Improve my English skills"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5 mb-4 focus:outline-none focus:ring-2 focus:ring-aussie-gold"
            />

            {/* Weekly post count */}
            <label className="text-xs text-gray-500">Posts per week</label>
            <div className="flex items-center justify-center gap-4 mt-1 mb-4">
              <button
                onClick={() => setGoalDraft((v) => Math.max(1, v - 1))}
                className="w-10 h-10 rounded-full bg-gray-100 text-lg font-bold text-gray-600"
              >
                −
              </button>
              <span className="text-3xl font-black text-ocean-blue w-12 text-center">{goalDraft}</span>
              <button
                onClick={() => setGoalDraft((v) => Math.min(30, v + 1))}
                className="w-10 h-10 rounded-full bg-gray-100 text-lg font-bold text-gray-600"
              >
                +
              </button>
            </div>
            <button onClick={handleSaveGoal} className="w-full bg-ocean-blue text-white font-bold text-sm py-2.5 rounded-xl">
              Save
            </button>
          </div>
        </div>
      )}

      {/* ===== 3. Banner Carousel ===== */}
      <div className="px-5 mt-3">
        <BannerCarousel location="home" bannerImageUrl={adminConfig?.bannerImageUrl} />
      </div>

      {/* ===== 4. Unified Resource Card ===== */}
      {(adminConfig?.message || adminConfig?.zoomUrl) && (
        <div className="px-5 mt-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Admin message */}
            {adminConfig.message && (
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[10px] font-bold text-outback-clay mb-0.5">From the team</p>
                <p className="text-xs text-gray-700 leading-snug">{adminConfig.message}</p>
              </div>
            )}

            {/* Zoom section */}
            {adminConfig.zoomUrl && (
              <div className={`px-4 py-3 transition-all ${
                zoomOpen ? "ring-2 ring-ocean-blue/50 shadow-md shadow-ocean-blue/10 rounded-b-2xl" : ""
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${zoomOpen ? "bg-green-400 animate-pulse" : "bg-gray-300"}`} />
                      <p className={`font-bold text-sm ${zoomOpen ? "text-ocean-blue" : "text-gray-600"}`}>
                        {adminConfig.zoomLabel || "Zoom Meeting"}
                      </p>
                      {zoomOpen && (
                        <span className="text-[10px] font-bold text-white bg-ocean-blue px-2 py-0.5 rounded-full animate-pulse">
                          LIVE
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ml-[18px] ${zoomOpen ? "text-gray-600" : "text-gray-400"}`}>
                      {zoomOpen ? "Meeting is in progress" : `Next: ${adminConfig.zoomNextInfo || "TBD"}`}
                    </p>
                  </div>
                  {zoomOpen ? (
                    <a
                      href={adminConfig.zoomUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-ocean-blue text-white text-sm font-bold px-4 py-2 rounded-xl shadow-md hover:bg-blue-600 transition-colors shrink-0"
                    >
                      Join
                    </a>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
