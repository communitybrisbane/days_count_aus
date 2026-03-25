"use client";

import { useEffect, useState, useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { calculateLevel, levelProgress, xpForLevel, getTodayStr } from "@/lib/utils";
import { useDayCount } from "@/hooks/useDayCount";
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
import WeeklyHistoryModal from "@/components/WeeklyHistoryModal";
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
  const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);
  const [weeklyPostCount, setWeeklyPostCount] = useState(0);
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneDay, setMilestoneDay] = useState(0);
  const [phasePrompt, setPhasePrompt] = useState<{ message: string; newStatus: string } | null>(null);
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string; link?: string } | null>(null);
  const [showWeeklyHistory, setShowWeeklyHistory] = useState(false);
  const dismissToast = useCallback(() => setToast(null), []);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  const dayCount = useDayCount(profile ?? null);

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

  // FCM: register token if already granted, or show banner for first-time choice
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      requestFCMToken().then((token) => { if (token) saveFCMToken(user.uid, token); });
    } else if (Notification.permission === "default" && !localStorage.getItem("notif_choice_made")) {
      setShowNotifBanner(true);
    }
  }, [user]);

  const handleNotifYes = async () => {
    if (!user) return;
    const token = await requestFCMToken();
    if (token) await saveFCMToken(user.uid, token);
    setShowNotifBanner(false);
    localStorage.setItem("notif_choice_made", "true");
  };

  const handleNotifNo = () => {
    setShowNotifBanner(false);
    localStorage.setItem("notif_choice_made", "true");
  };

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

  // PWA install banner
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window.navigator as any).standalone === true) return;
    // Already dismissed (re-show after 7 days)
    const dismissed = localStorage.getItem("pwa_install_dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    if (ios) {
      setShowInstallBanner(true);
    } else {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowInstallBanner(true);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (deferredPrompt) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (deferredPrompt as any).prompt();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (deferredPrompt as any).userChoice;
      if (result.outcome === "accepted") setShowInstallBanner(false);
      setDeferredPrompt(null);
    }
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem("pwa_install_dismissed", String(Date.now()));
  };

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

  if (loading || !profile) return <LoadingSpinner fullScreen />;

  const goalCleared = weeklyGoal > 0 && weeklyPostCount >= weeklyGoal;

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ paddingBottom: "calc(3rem + env(safe-area-inset-bottom, 0px))" }}>
      <NotificationToast show={!!toast} title={toast?.title || ""} body={toast?.body || ""} link={toast?.link} onDismiss={dismissToast} />
      <MilestoneAnimation dayNumber={milestoneDay} show={showMilestone} onClose={() => setShowMilestone(false)} />

      {/* PWA Install Full-Screen Modal */}
      {showInstallBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center w-full max-w-sm mx-6">
            {!showIOSGuide ? (
              <>
                <img src="/icons/kangaroo-like.png" alt="" width={80} height={80} className="mb-6 drop-shadow-lg" style={{ objectFit: "contain" }} />
                <h2 className="text-2xl font-black text-white mb-2 text-center">Add Count to Home</h2>
                <p className="text-sm text-white/50 text-center mb-8">Get the full app experience with push notifications</p>
                <button
                  onClick={handleInstall}
                  className="w-full py-4 bg-accent-orange text-white text-lg font-black rounded-2xl shadow-lg shadow-accent-orange/30 active:scale-95 transition-transform"
                >
                  Add to Home Screen
                </button>
                <button onClick={dismissInstallBanner} className="mt-4 text-sm text-white/30 active:text-white/50">
                  Not now
                </button>
              </>
            ) : (
              <div className="bg-forest-dark border border-forest-light/20 rounded-2xl w-full p-6">
                <h3 className="text-lg font-bold text-white text-center mb-5">Almost there!</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="bg-accent-orange text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">1</span>
                    <p className="text-sm text-white/80">Tap the <span className="text-accent-orange font-bold">Share</span> button <span className="text-white/40">(square with arrow)</span> at the bottom of Safari</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-accent-orange text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">2</span>
                    <p className="text-sm text-white/80">Scroll and tap <span className="font-bold text-accent-orange">Add to Home Screen</span></p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-accent-orange text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">3</span>
                    <p className="text-sm text-white/80">Tap <span className="font-bold text-accent-orange">Add</span> — push notifications will work too!</p>
                  </div>
                </div>
                <button onClick={() => { setShowIOSGuide(false); dismissInstallBanner(); }} className="mt-6 w-full py-3 bg-accent-orange text-white font-bold rounded-xl text-sm">
                  Got it!
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {phasePrompt && (
        <ConfirmModal
          title="Phase Transition"
          message={phasePrompt.message}
          confirmLabel="Yes, switch"
          onConfirm={handlePhaseTransition}
          onCancel={dismissPhasePrompt}
        />
      )}

      {/* ===== 1. Hero Header — Fixed, Day Count with polygon overlay ===== */}
      <div className="shrink-0 relative text-white pb-10 px-6 rounded-b-[2rem] overflow-hidden" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top, 0px))" }}>
        {/* Polygon gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent-orange via-accent-orange-light to-accent-orange-dark" />
        {/* Geometric polygon overlays */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rotate-45" />
          <div className="absolute bottom-0 -left-4 w-32 h-32 bg-white/8 rotate-12" />
          <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-white/5 -rotate-30" />
        </div>

        <div className="relative">
          <p className="text-white/60 text-xs font-medium tracking-widest uppercase mb-4">
            {STATUS_LABELS[profile.status || "pre-departure"] ?? profile.status}
          </p>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[3.25rem] font-black tracking-tight leading-none">
              {dayCount.label} {dayCount.number < 0 ? "−" : "+"} {Math.abs(dayCount.number)}
            </span>
          </div>

          <p className="text-white/50 text-sm mt-1">
            Hello, {profile.displayName}
          </p>
        </div>
      </div>

      {/* ===== Scrollable content ===== */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">

      {/* Notification choice banner */}
      {showNotifBanner && (
        <div className="mx-5 mt-3 bg-forest-mid/40 border border-forest-light/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl">🔔</span>
          <p className="flex-1 text-sm text-white/80">Turn on notifications?</p>
          <button onClick={handleNotifYes} className="px-3 py-1.5 bg-accent-orange text-white text-xs font-bold rounded-lg">
            Yes
          </button>
          <button onClick={handleNotifNo} className="px-3 py-1.5 bg-white/10 text-white/50 text-xs font-bold rounded-lg">
            No
          </button>
        </div>
      )}


      {/* ===== 2. Weekly Goal — Material Card ===== */}
      <div className="px-5 mt-3 relative z-10">
        <div className="bg-forest-mid/40 border border-forest-light/20 rounded-2xl overflow-hidden transition-all duration-500">
          <div className="px-4 pt-4 pb-3">
            {/* Goal text + edit button */}
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0 flex-1">
                {profile.goal ? (
                  <p className="text-sm font-bold text-white/90 leading-snug">{profile.goal}</p>
                ) : (
                  <p className="text-sm text-white/30 italic">No goal set</p>
                )}
              </div>
              <button onClick={() => setShowWeeklyHistory(true)} className="shrink-0 ml-3 p-1.5 active:bg-white/10 rounded-lg transition-colors">
                <IconEdit size={18} className="text-white/30" />
              </button>
            </div>

            <div onClick={() => setShowWeeklyHistory(true)} className="cursor-pointer active:opacity-80">
              <WeeklyChallenge
                weekStreak={profile.weekStreak ?? 0}
                weeklyPostCount={weeklyPostCount}
                goalCleared={goalCleared}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===== 3. XP / Level ===== */}
      <div className="px-5 mt-3">
        <div className="bg-forest-mid/40 border border-forest-light/20 rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-black text-accent-orange tabular-nums leading-none">Lv.{level}</span>
            <span className="text-[11px] text-white/40 tabular-nums font-medium">{profile.totalXP} / {xpForLevel(level + 1)} XP</span>
          </div>
          <div className="relative">
            <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-orange to-accent-orange-light rounded-full transition-all duration-700"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div
              className="absolute top-1/2 transition-all duration-700 pointer-events-none"
              style={{ left: `${Math.min(progress, 100)}%`, transform: `translateX(-55%) translateY(-50%)` }}
            >
              <img src="/icons/kangaroo-like.png" alt="" width={30} height={30} draggable={false} className="drop-shadow-sm" style={{ width: 30, height: 30, objectFit: "contain" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Weekly history + Goal edit modal */}
      {showWeeklyHistory && user && (
        <WeeklyHistoryModal
          uid={user.uid}
          goal={profile?.goal || ""}
          onClose={() => setShowWeeklyHistory(false)}
          onSaveGoal={async (newGoal) => {
            await updateDoc(doc(db, "users", user.uid), { goal: newGoal });
            await refreshProfile();
          }}
        />
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
              info: { bg: "bg-forest-light/10", border: "border-forest-light/20", title: "text-lime", dot: "bg-lime" },
              warning: { bg: "bg-red-500/10", border: "border-red-500/20", title: "text-red-400", dot: "bg-red-400" },
              event: { bg: "bg-accent-orange/10", border: "border-accent-orange/20", title: "text-accent-orange", dot: "bg-accent-orange" },
            };
            const c = colors[ann.type] || colors.info;
            return (
              <div key={i} className={`${c.bg} border ${c.border} rounded-xl px-4 py-3`}>
                <div className="flex items-start gap-2">
                  <span className={`w-2 h-2 rounded-full ${c.dot} mt-1 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${c.title}`}>{ann.title}</p>
                    {ann.body && <p className="text-xs text-white/60 mt-0.5 leading-snug">{ann.body}</p>}
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

      </div>{/* end scrollable content */}

      <BottomNav />
    </div>
  );
}
