"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { FOCUS_MODES, GRADIENTS, WEEKLY_XP, WEEK_STREAK_BONUS, WEEK_STREAK_MAX, WEEK_STREAK_THRESHOLD, FIRST_POST_BONUS, POST_XP, POST_XP_DAILY_MAX, POST_CONTENT_MAX, HASHTAG_MAX, REGIONS } from "@/lib/constants";
import { calculateLevel } from "@/lib/utils";
import { useDayCount } from "@/hooks/useDayCount";
import { createPost, isFirstPost, updateUserXPAndStreak, getBannedWords, containsBannedWord, getWeeklyPostCount, getDailyPostCount } from "@/lib/services/posts";
import dynamic from "next/dynamic";
const ImageCropper = dynamic(() => import("@/components/ImageCropper"), { ssr: false });
import LoadingSpinner from "@/components/LoadingSpinner";
import RegionWheelModal from "@/components/RegionWheelModal";
import XPToast from "@/components/XPToast";
import LevelUpAnimation from "@/components/LevelUpAnimation";
import Avatar from "@/components/Avatar";
import { IconCamera, IconGlobe, IconLock, IconBoomerang, IconKangaroo, FocusModeIcon } from "@/components/icons";
import AsciiWarn from "@/components/AsciiWarn";
import { useAsciiInput } from "@/hooks/useAsciiInput";

export default function PostPage() {
  const { user, profile, loading } = useAuthGuard();
  const { refreshProfile } = useAuth();
  const { showWarn, sanitize } = useAsciiInput();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState("");
  const [content, setContent] = useState("");
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [cropSrc, setCropSrc] = useState<string>("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [postRegion, setPostRegion] = useState("");
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [customDayNumber, setCustomDayNumber] = useState<number | null>(null);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  const [showXP, setShowXP] = useState(false);
  const [levelUpTo, setLevelUpTo] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const dayCount = useDayCount(profile ?? null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Set defaults from profile
  useEffect(() => {
    if (!profile) return;
    if (!mode && profile.mainMode) setMode(profile.mainMode);
    if (!postRegion && profile.region) setPostRegion(profile.region);
  }, [profile, mode, postRegion]);


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < HASHTAG_MAX ? [...prev, tag] : prev
    );
  };

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!t || tags.length >= HASHTAG_MAX) return;
    const formatted = `#${t}`;
    if (!tags.includes(formatted)) setTags((prev) => [...prev, formatted]);
    setCustomTag("");
  };

  const handleCropComplete = (blob: Blob) => {
    setImageBlob(blob);
    setImagePreview(URL.createObjectURL(blob));
    setCropSrc("");
  };

  const handleSubmit = async () => {
    if (!user || !profile || !mode) return;

    setSubmitting(true);
    try {
      const [bannedWords, firstPost] = await Promise.all([
        getBannedWords(),
        isFirstPost(user.uid),
      ]);
      const matched = containsBannedWord(content.trim(), bannedWords);
      if (matched) {
        alert("Your post contains inappropriate language. Please revise it.");
        setSubmitting(false);
        return;
      }

      await createPost({
        userId: user.uid,
        mode,
        content: content.trim(),
        phase: profile.status || "pre-departure",
        dayNumber: currentDay,
        visibility,
        imageBlob,
        tags,
        region: postRegion || "",
      });

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const alreadyPostedToday = profile.lastPostAt
        && new Date(profile.lastPostAt).toISOString().slice(0, 10) === todayStr;

      let totalXpGain = 0;
      let newStreak = 1;

      // Post XP: 10 XP per post, up to 3 posts per day
      const [dailyCount, weeklyCount] = await Promise.all([
        getDailyPostCount(user.uid),
        !alreadyPostedToday ? getWeeklyPostCount(user.uid) : Promise.resolve(0),
      ]);
      if (dailyCount <= POST_XP_DAILY_MAX) {
        totalXpGain += POST_XP;
      }

      if (!alreadyPostedToday) {
        const streakWeeks = Math.min(profile.weekStreak || 0, WEEK_STREAK_MAX);
        const baseXp = weeklyCount < 7 ? WEEKLY_XP[weeklyCount] : 0;
        const streakBonus = weeklyCount < 7 ? streakWeeks * WEEK_STREAK_BONUS : 0;
        totalXpGain += baseXp + streakBonus + (firstPost ? FIRST_POST_BONUS : 0);

        if (profile.lastPostAt) {
          const lastPostStr = new Date(profile.lastPostAt).toISOString().slice(0, 10);
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          if (lastPostStr === yesterday.toISOString().slice(0, 10)) {
            newStreak = (profile.currentStreak ?? 0) + 1;
          }
        }

        if (weeklyCount === WEEK_STREAK_THRESHOLD - 1) {
          const { updateWeekStreak } = await import("@/lib/services/users");
          await updateWeekStreak(user.uid, profile.weekStreak, profile.lastCompletedWeekStart);
        }
      } else {
        newStreak = profile.currentStreak ?? 1;
      }

      const prevLevel = calculateLevel(profile.totalXP);
      await updateUserXPAndStreak(user.uid, totalXpGain, newStreak);
      await refreshProfile();

      setXpGained(totalXpGain);
      setShowXP(true);

      const newLevel = calculateLevel(profile.totalXP + totalXpGain);
      if (newLevel > prevLevel) {
        setTimeout(() => {
          setShowXP(false);
          setLevelUpTo(newLevel);
          setShowLevelUp(true);
        }, 1200);
      } else {
        setTimeout(() => {
          setShowXP(false);
          router.push("/home");
        }, 1500);
      }
    } catch (error) {
      console.error("Post failed:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !profile) {
    return <LoadingSpinner fullScreen />;
  }

  if (profile.restricted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3 px-6 text-center">
        <p className="text-white/40 text-sm">This account has been restricted. Posting is not available.</p>
        <button onClick={() => router.back()} className="text-sm text-white/30 border border-white/20 px-4 py-1.5 rounded-full">Go back</button>
      </div>
    );
  }

  const modeInfo = FOCUS_MODES.find((m) => m.id === mode);
  const gradientIdx = mode ? FOCUS_MODES.findIndex((m) => m.id === mode) : 0;
  const gradient = GRADIENTS[gradientIdx >= 0 ? gradientIdx : 0];
  const todayStr = new Date().toLocaleDateString("en-AU");
  const currentDay = customDayNumber !== null ? customDayNumber : dayCount.number;

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <XPToast xp={xpGained} show={showXP} />
      <LevelUpAnimation
        level={levelUpTo}
        show={showLevelUp}
        onClose={() => { setShowLevelUp(false); router.push("/home"); }}
      />
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropSrc("")}
        />
      )}
      {/* Region picker modal — drum wheel */}
      {showRegionPicker && (
        <RegionWheelModal
          value={postRegion}
          onDone={(r) => { setPostRegion(r); setShowRegionPicker(false); }}
          onClose={() => setShowRegionPicker(false)}
        />
      )}
      {/* Day picker modal — select date to compute day number */}
      {showDayPicker && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowDayPicker(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-sm">Select Date</h3>
              <button onClick={() => setShowDayPicker(false)} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center" aria-label="Close">&times;</button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange"
              />
              {dateInput && (
                <p className="text-center text-sm text-gray-500">
                  {(() => {
                    const dep = profile?.departureDate;
                    if (!dep) return `D+0`;
                    const depDate = new Date(dep + "T00:00:00");
                    const selected = new Date(dateInput + "T00:00:00");
                    const diff = Math.floor((selected.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (diff >= 0) return `D+${diff + 1}`;
                    return `D${diff}`;
                  })()}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setCustomDayNumber(null); setShowDayPicker(false); }}
                  className="flex-1 py-2.5 text-xs font-bold text-gray-500 bg-gray-100 rounded-xl"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const dep = profile?.departureDate;
                    if (!dep || !dateInput) { setShowDayPicker(false); return; }
                    const depDate = new Date(dep + "T00:00:00");
                    const selected = new Date(dateInput + "T00:00:00");
                    const diff = Math.floor((selected.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24));
                    setCustomDayNumber(diff >= 0 ? diff + 1 : diff);
                    setShowDayPicker(false);
                  }}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-accent-orange rounded-xl"
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header — back button left, post button right */}
      <div
        className="shrink-0 flex items-center justify-between px-2 py-2 bg-forest/95 backdrop-blur-md border-b border-forest-light/20"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}
      >
        <button
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center text-white/70 active:text-white"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 4L7 10L13 16" />
          </svg>
        </button>
        <button
          disabled={!mode || submitting}
          onClick={handleSubmit}
          className="px-5 py-2 rounded-full bg-accent-orange text-white text-sm font-bold disabled:opacity-40 active:scale-[0.96] transition-transform"
        >
          {submitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
          ) : (
            "Post"
          )}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide" ref={scrollAreaRef}>

        {/* ── PostCard-style preview ── */}
        <div className="mx-3 mt-3 bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          {/* Author header — matches PostCard */}
          <div className="flex items-center gap-3 p-3">
            <Avatar
              photoURL={profile.photoURL}
              displayName={profile.displayName || "?"}
              uid={user?.uid || ""}
              size={36}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{profile.displayName || "You"}</p>
              <p className="text-xs text-gray-400">
                {todayStr} ·{" "}
                {/* Mode toggle — tap to cycle through the 3 modes */}
                <button
                  onClick={() => {
                    const idx = FOCUS_MODES.findIndex((m) => m.id === mode);
                    setMode(FOCUS_MODES[(idx + 1) % FOCUS_MODES.length].id);
                  }}
                  className="inline-flex items-center gap-0.5 text-accent-orange font-medium active:opacity-70"
                  aria-label="Change mode"
                >
                  {modeInfo && <FocusModeIcon modeId={modeInfo.id} size={12} className="inline-block align-middle" />}
                  {modeInfo?.label || "Select a mode"}
                </button>
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowRegionPicker(true)}
                className="text-[10px] bg-forest-mid/10 text-forest-mid px-2 py-0.5 rounded-full font-medium border border-forest-mid/20 active:bg-forest-mid/20"
              >
                {postRegion || "Select region"}
              </button>
              <button
                onClick={() => { setDateInput(new Date().toISOString().slice(0, 10)); setShowDayPicker(true); }}
                className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-500 border border-gray-200 active:bg-gray-200"
              >
                {currentDay > 0 ? `D+${currentDay}` : `D${currentDay}`}
              </button>
            </div>
          </div>

          {/* Image area — tappable to add/change photo */}
          <div
            className="relative cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {imagePreview ? (
              <div className="relative group">
                <img src={imagePreview} alt="" className="w-full aspect-square object-cover" />
                <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="text-white/0 group-active:text-white/80 transition-colors text-[10px] font-bold">Tap to change photo</span>
                </div>
              </div>
            ) : (
              <div className={`w-full aspect-[4/3] bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2`}>
                <IconCamera size={28} className="text-white/40" />
                <p className="text-white/40 text-xs font-medium">Tap to add photo</p>
              </div>
            )}
            {/* Visibility toggle — tap to switch, without opening the photo picker */}
            <button
              onClick={(e) => { e.stopPropagation(); setVisibility(visibility === "public" ? "private" : "public"); }}
              className="absolute top-2 left-2 bg-black/50 text-white rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold active:bg-black/70"
              aria-label="Toggle visibility"
            >
              {visibility === "public" ? <IconGlobe size={14} /> : <IconLock size={14} />}
              {visibility === "public" ? "Public" : "Private"}
            </button>
          </div>

          {/* Content + tags — edited in place, styled like PostCard */}
          <div className="p-3">
            <textarea
              value={content}
              onChange={(e) => setContent(sanitize(e.target.value, /[^\x20-\x7E\n\u{1F300}-\u{1FAF8}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu))}
              maxLength={POST_CONTENT_MAX}
              rows={3}
              placeholder="What happened today? (English only)"
              className="w-full text-sm text-gray-700 placeholder-gray-300 bg-transparent focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between -mt-1">
              <AsciiWarn show={showWarn} />
              <p className="text-[10px] text-gray-300 ml-auto">{content.length}/{POST_CONTENT_MAX}</p>
            </div>

            {/* Tags — tap a tag to remove it, type to add */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="text-xs text-accent-orange font-medium active:opacity-60"
                  aria-label={`Remove ${tag}`}
                >
                  {tag} <span className="text-accent-orange/50">&times;</span>
                </button>
              ))}
              {tags.length < HASHTAG_MAX && (
                <span className="inline-flex items-center text-xs text-accent-orange font-medium">
                  {/* Live "#" prefix so the tag appears as you type */}
                  {customTag && <span>#</span>}
                  <input
                    type="text"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                    onBlur={addCustomTag}
                    placeholder={tags.length === 0 ? "#tags" : "#"}
                    maxLength={20}
                    size={Math.max(customTag.length, 4)}
                    className="text-xs text-accent-orange font-medium placeholder-gray-300 bg-transparent focus:outline-none"
                    style={{ width: `${Math.max(customTag.length, 4) + 1}ch` }}
                  />
                </span>
              )}
            </div>
          </div>

          {/* Actions placeholder — matches PostCard */}
          <div className="flex items-center px-3 pb-3">
            <div className="flex items-center gap-1 text-gray-300">
              <IconKangaroo size={18} />
              <span className="text-sm">0</span>
            </div>
          </div>
        </div>

        {/* ── Controls below preview ── */}
        <div className="px-4 mt-3 space-y-1.5">

          {/* Remove photo */}
          {imagePreview && (
            <button
              onClick={() => { setImageBlob(null); setImagePreview(""); }}
              className="w-full py-2 text-xs text-white/40 active:text-white/60"
            >
              Remove photo
            </button>
          )}
        </div>

        {/* Spacer for bottom */}
        <div className="h-8" />
      </div>
    </div>
  );
}
