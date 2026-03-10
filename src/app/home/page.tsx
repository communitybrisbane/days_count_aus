"use client";

import { useEffect, useState, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { getDayCount, formatDayCount, calculateLevel, levelProgress } from "@/lib/utils";
import { fetchTotalLikesAndWeekly } from "@/lib/services/posts";
import { fetchAdminConfig, saveFCMToken } from "@/lib/services/users";
import { requestFCMToken, onFCMMessage } from "@/lib/fcm";
import BottomNav from "@/components/layout/BottomNav";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmModal from "@/components/ConfirmModal";
import MilestoneAnimation from "@/components/MilestoneAnimation";
import BannerCarousel from "@/components/BannerCarousel";
import { MILESTONES } from "@/lib/constants";
import { IconHeart, IconFire, IconDiary } from "@/components/icons";

interface AdminConfig {
  message: string;
  eventName: string;
  eventDate: string;
  eventUrl: string;
  /** ホームのヒーローバナー画像URL。Firebase Storage の URL を設定すると、ここで画像を差し替え可能。 */
  bannerImageUrl?: string;
}

interface WeeklyStats {
  postCount: number;
  streak: number;
}

export default function HomePage() {
  const { user, profile, loading } = useAuthGuard();
  const { refreshProfile } = useAuth();
  const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);
  const [totalLikes, setTotalLikes] = useState(0);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({ postCount: 0, streak: 0 });
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneDay, setMilestoneDay] = useState(0);
  const [phasePrompt, setPhasePrompt] = useState<{ message: string; newStatus: string } | null>(null);
  const [showNotifBanner, setShowNotifBanner] = useState(false);

  const dayCount = useMemo(() => {
    if (!profile) return { label: "D", number: 0 };
    return getDayCount(profile.status, profile.departureDate, profile.returnStartDate);
  }, [profile]);

  const dayCountStr = formatDayCount(dayCount.label, dayCount.number);
  const level = profile ? calculateLevel(profile.totalXP) : 1;
  const progress = profile ? levelProgress(profile.totalXP) : 0;

  useEffect(() => {
    if (!user) return;
    fetchAdminConfig().then((data) => {
      if (data) setAdminConfig(data as AdminConfig);
    }).catch((e) => console.error("Failed to fetch admin config:", e));
  }, [user]);

  useEffect(() => {
    if (!user || !profile) return;
    fetchTotalLikesAndWeekly(user.uid).then(({ totalLikes: likes, weeklyPostCount }) => {
      setTotalLikes(likes);
      setWeeklyStats({ postCount: weeklyPostCount, streak: profile.currentStreak || 0 });
    }).catch(console.error);
  }, [user, profile]);

  useEffect(() => {
    if (!profile) return;
    if (dayCount.label === "D" && dayCount.number > 0) {
      const milestone = MILESTONES.find((m) => m === dayCount.number);
      if (milestone) {
        const key = `milestone_${milestone}_shown`;
        if (!localStorage.getItem(key)) {
          setMilestoneDay(milestone);
          setShowMilestone(true);
          localStorage.setItem(key, "true");
        }
      }
    }
  }, [dayCount, profile]);

  // FCM: check notification permission and request token
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      // Show banner if not yet asked
      if (!localStorage.getItem("notif_banner_dismissed")) {
        setShowNotifBanner(true);
      }
    } else if (Notification.permission === "granted") {
      // Already granted — ensure token is saved
      requestFCMToken().then((token) => {
        if (token) saveFCMToken(user.uid, token);
      });
    }
  }, [user]);

  // FCM: listen for foreground messages
  useEffect(() => {
    if (!user) return;
    return onFCMMessage((payload: unknown) => {
      const p = payload as { notification?: { title?: string; body?: string } };
      if (p.notification?.title) {
        alert(`${p.notification.title}\n${p.notification.body || ""}`);
      }
    });
  }, [user]);

  const handleEnableNotifications = async () => {
    if (!user) return;
    const token = await requestFCMToken();
    if (token) {
      await saveFCMToken(user.uid, token);
    }
    setShowNotifBanner(false);
    localStorage.setItem("notif_banner_dismissed", "true");
  };

  const dismissNotifBanner = () => {
    setShowNotifBanner(false);
    localStorage.setItem("notif_banner_dismissed", "true");
  };

  // Phase auto-transition check
  useEffect(() => {
    if (!profile || !profile.departureDate) return;
    const today = new Date().toISOString().slice(0, 10);
    const sessionKey = `phase_prompt_dismissed_${profile.status}`;
    if (sessionStorage.getItem(sessionKey)) return;

    if (profile.status === "pre-departure" && today >= profile.departureDate) {
      setPhasePrompt({
        message: "Your departure date has passed. Start your working holiday?",
        newStatus: "in-australia",
      });
    } else if (profile.status === "in-australia" && dayCount.number >= 365) {
      setPhasePrompt({
        message: "You've been in Australia for over 365 days. Switch to post-return?",
        newStatus: "post-return",
      });
    }
  }, [profile, dayCount]);

  const handlePhaseTransition = async () => {
    if (!user || !phasePrompt) return;
    const updates: Record<string, unknown> = { status: phasePrompt.newStatus };
    if (phasePrompt.newStatus === "post-return") {
      const today = new Date();
      updates.returnStartDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    }
    await updateDoc(doc(db, "users", user.uid), updates);
    await refreshProfile();
    setPhasePrompt(null);
  };

  const dismissPhasePrompt = () => {
    if (profile) {
      sessionStorage.setItem(`phase_prompt_dismissed_${profile.status}`, "true");
    }
    setPhasePrompt(null);
  };

  if (loading || !profile) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="pb-16 flex flex-col min-h-dvh">
      <MilestoneAnimation
        dayNumber={milestoneDay}
        show={showMilestone}
        onClose={() => setShowMilestone(false)}
      />

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
          <button
            onClick={handleEnableNotifications}
            className="px-3 py-1.5 bg-ocean-blue text-white text-xs font-bold rounded-lg shrink-0"
          >
            Enable
          </button>
          <button onClick={dismissNotifBanner} className="text-gray-400 text-lg leading-none">×</button>
        </div>
      )}

      {/* Main Counter */}
      <div className="bg-gradient-to-br from-aussie-gold to-amber-500 text-white pt-7 pb-5 px-6 rounded-b-3xl">
        <p className="text-xs opacity-80 mb-0.5">
          {profile.status === "pre-departure" ? "Before departure"
            : profile.status === "in-australia" ? "In Australia"
            : "After return"}
        </p>
        <h1 className="text-4xl font-black tracking-tight mb-1">{dayCountStr}</h1>
        <p className="text-xs opacity-80">Hello, {profile.displayName}!</p>
      </div>

      {/* Level + Progress */}
      <div className="px-5 -mt-4">
        <div className="bg-white rounded-2xl shadow-md px-4 py-2">
          <div className="mb-1">
            <span className="text-sm font-bold text-ocean-blue">Lv.{level}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-ocean-blue h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats: 3 columns */}
      <div className="px-5 mt-2 grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-xl py-1.5 text-center">
          <p className="text-base font-bold text-ocean-blue flex items-center justify-center gap-1"><IconDiary size={16} className="text-ocean-blue" /> {weeklyStats.postCount}</p>
          <p className="text-[10px] text-gray-400">This Week</p>
        </div>
        <div className="bg-gray-50 rounded-xl py-1.5 text-center">
          <p className="text-base font-bold text-pink-500 flex items-center justify-center gap-1"><IconHeart size={16} className="text-pink-500" /> {totalLikes}</p>
          <p className="text-[10px] text-gray-400">Total Likes</p>
        </div>
        <div className="bg-gray-50 rounded-xl py-1.5 text-center">
          <p className="text-base font-bold text-outback-clay flex items-center justify-center gap-1"><IconFire size={16} className="text-outback-clay" /> {profile.currentStreak}</p>
          <p className="text-[10px] text-gray-400">Streak</p>
        </div>
      </div>

      {/* Banner carousel（画像のみ。Firebase admin_config.bannerImageUrl で差し替え可能） */}
      <div className="px-5 mt-2">
        <BannerCarousel location="home" bannerImageUrl={adminConfig?.bannerImageUrl} />
      </div>

      {/* Admin message */}
      {adminConfig?.message && (
        <div className="px-5 mt-2">
          <div className="bg-orange-50 rounded-xl px-4 py-2 border border-outback-clay/15">
            <p className="text-[10px] font-bold text-outback-clay mb-0.5">From the team</p>
            <p className="text-xs text-gray-700 leading-snug">{adminConfig.message}</p>
          </div>
        </div>
      )}

      {/* Event button */}
      {adminConfig?.eventUrl && (
        <div className="px-5 mt-2">
          <a
            href={adminConfig.eventUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full bg-outback-clay text-white rounded-xl px-4 py-2.5"
          >
            <div>
              <p className="font-bold text-sm">{adminConfig.eventName || "Next Event"}</p>
              {adminConfig.eventDate && (
                <p className="text-xs opacity-80 mt-0.5">{adminConfig.eventDate}</p>
              )}
            </div>
            <span className="text-lg">→</span>
          </a>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
