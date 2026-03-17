"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { getDayCount, calculateLevel, levelProgress, xpForLevel, getTodayStr } from "@/lib/utils";
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
import WeeklyChallenge from "@/components/WeeklyChallenge";
import AsciiWarn from "@/components/AsciiWarn";
import { useAsciiInput } from "@/hooks/useAsciiInput";
import NotificationToast from "@/components/NotificationToast";
import type { AdminConfig } from "@/types";

const STATUS_LABELS: Record<string, string> = {
  "pre-departure": "Before departure",
  "in-australia": "In Australia",
  "post-return": "After return",
};

export default function HomePage() {
  const { user, profile, loading } = useAuthGuard();
  const { refreshProfile } = useAuth();
  const { showWarn, sanitize } = useAsciiInput();
  const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);
  const [weeklyPostCount, setWeeklyPostCount] = useState(0);
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneDay, setMilestoneDay] = useState(0);
  const [phasePrompt, setPhasePrompt] = useState<{ message: string; newStatus: string } | null>(null);
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [goalTextDraft, setGoalTextDraft] = useState("");
  const [toast, setToast] = useState<{ title: string; body: string; link?: string } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  // createdAt: Firestore Timestamp → Date
  const createdAtDate = useMemo(() => {
    const ca = profile?.createdAt as { toDate?: () => Date } | undefined;
    return ca?.toDate?.() ?? null;
  }, [profile]);

  const dayCount = useMemo(() => {
    if (!profile) return { label: "D", number: 0 };
    return getDayCount(profile.status || "pre-departure", profile.departureDate || "", profile.returnStartDate, createdAtDate);
  }, [profile, createdAtDate]);

  const level = profile ? calculateLevel(profile.totalXP) : 1;
  const progress = profile ? levelProgress(profile.totalXP) : 0;

  const weeklyGoal = 7;

  // Fetch admin config
  useEffect(() => {
    if (!user) return;
    fetchAdminConfig().then((data) => {
      if (data) setAdminConfig(data as AdminConfig);
    }).catch((e) => console.error("Failed to fetch admin config:", e));
  }, [user]);

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
      const p = payload as { notification?: { title?: string; body?: string }; fcmOptions?: { link?: string } };
      if (p.notification?.title) {
        setToast({ title: p.notification.title, body: p.notification.body || "", link: p.fcmOptions?.link });
      }
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
    await updateDoc(doc(db, "users", user.uid), { goal: goalTextDraft.trim() });
    await refreshProfile();
    setShowGoalInput(false);
  };

  const openGoalInput = () => {
    setGoalTextDraft(profile?.goal || "");
    setShowGoalInput(true);
  };

  if (loading || !profile) return <LoadingSpinner fullScreen />;

  const goalCleared = weeklyGoal > 0 && weeklyPostCount >= weeklyGoal;

  return (
    <div className="pb-18 flex flex-col min-h-dvh">
      <NotificationToast show={!!toast} title={toast?.title || ""} body={toast?.body || ""} link={toast?.link} onDismiss={dismissToast} />
      <AsciiWarn show={showWarn} />
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

      {/* ===== 1. Hero Header — Day Count Only ===== */}
      <div className="bg-gradient-to-br from-aussie-gold via-amber-500 to-orange-400 text-white pb-10 px-6 rounded-b-[2rem] relative overflow-hidden" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top, 0px))" }}>
        {/* Subtle background texture */}
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

        <div className="relative">
          <p className="text-white/70 text-xs font-medium tracking-widest uppercase mb-4">
            {STATUS_LABELS[profile.status || "pre-departure"] ?? profile.status}
          </p>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[3.25rem] font-black tracking-tight leading-none">
              {dayCount.label} {dayCount.number < 0 ? "−" : "+"} {Math.abs(dayCount.number)}
            </span>
          </div>

          <p className="text-white/60 text-sm mt-1">
            Hello, {profile.displayName}
          </p>
        </div>
      </div>

      {/* ===== 2. Weekly Goal — Main Card (7 days fixed) ===== */}
      <div className="px-5 -mt-6 relative z-10">
        <div className={`rounded-2xl shadow-lg overflow-hidden transition-all duration-500 ${
          goalCleared
            ? "ring-2 ring-aussie-gold/40 shadow-aussie-gold/15"
            : "shadow-gray-200/80"
        }`}>
          <div className={`px-5 pt-5 pb-5 ${goalCleared ? "bg-gradient-to-br from-amber-50/80 to-yellow-50/60" : "bg-white"}`}>
            {/* Goal text + edit button top-right */}
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0 flex-1">
                {profile.goal ? (
                  <p className="text-base font-bold text-gray-800 leading-snug">{profile.goal}</p>
                ) : (
                  <p className="text-base text-gray-400 italic">No goal set</p>
                )}
                {goalCleared && (
                  <span className="inline-block mt-1 text-[10px] font-black text-white bg-gradient-to-r from-aussie-gold to-amber-500 px-2.5 py-0.5 rounded-full shadow-sm">
                    Complete!
                  </span>
                )}
              </div>
              <button onClick={openGoalInput} className="shrink-0 ml-3 p-1.5 active:bg-gray-100 rounded-lg transition-colors">
                <IconEdit size={18} className="text-gray-400" />
              </button>
            </div>

            <WeeklyChallenge
              weekStreak={profile.weekStreak ?? 0}
              weeklyPostCount={weeklyPostCount}
              goalCleared={goalCleared}
            />
          </div>
        </div>
      </div>

      {/* ===== 3. XP / Level — Compact Row ===== */}
      <div className="px-5 mt-3">
        <div className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
          <span className="text-lg font-black text-gray-800">Lv.{level}</span>
          <div className="flex-1">
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-aussie-gold to-amber-400 h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
          <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">
            {xpForLevel(level + 1) - profile.totalXP} XP to next
          </span>
        </div>
      </div>

      {/* Goal text modal */}
      {showGoalInput && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-8" onClick={() => setShowGoalInput(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-gray-800 mb-3">My Goal</p>
            <label className="text-xs text-gray-500">What are you working towards?</label>
            <input
              type="text"
              maxLength={100}
              value={goalTextDraft}
              onChange={(e) => setGoalTextDraft(sanitize(e.target.value))}
              placeholder="e.g. Improve my English skills"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5 mb-4 focus:outline-none focus:ring-2 focus:ring-aussie-gold"
            />
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

      {/* ===== 4. Announcements ===== */}
      {adminConfig?.announcements && adminConfig.announcements.filter((a) => a.active).length > 0 && (
        <div className="px-5 mt-3 space-y-2">
          {adminConfig.announcements.filter((a) => a.active).map((ann, i) => {
            const colors = {
              info: { bg: "bg-blue-50", border: "border-blue-100", title: "text-blue-700", dot: "bg-blue-400" },
              warning: { bg: "bg-red-50", border: "border-red-100", title: "text-red-600", dot: "bg-red-400" },
              event: { bg: "bg-amber-50", border: "border-amber-200", title: "text-amber-700", dot: "bg-amber-400" },
            };
            const c = colors[ann.type] || colors.info;
            return (
              <div key={i} className={`${c.bg} border ${c.border} rounded-xl px-4 py-3`}>
                <div className="flex items-start gap-2">
                  <span className={`w-2 h-2 rounded-full ${c.dot} mt-1 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${c.title}`}>{ann.title}</p>
                    {ann.body && <p className="text-xs text-gray-600 mt-0.5 leading-snug">{ann.body}</p>}
                    {ann.linkUrl && (
                      <a
                        href={ann.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-block text-xs font-bold ${c.title} mt-1.5 underline underline-offset-2`}
                      >
                        {ann.linkLabel || "View details"}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
