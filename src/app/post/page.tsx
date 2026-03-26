"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { FOCUS_MODES, GRADIENTS, WEEKLY_XP, WEEK_STREAK_BONUS, WEEK_STREAK_MAX, WEEK_STREAK_THRESHOLD, FIRST_POST_BONUS, POST_XP, POST_XP_DAILY_MAX, POST_CONTENT_MAX, HASHTAG_SUGGESTIONS, HASHTAG_MAX, REGIONS } from "@/lib/constants";
import { calculateLevel } from "@/lib/utils";
import { useDayCount } from "@/hooks/useDayCount";
import { createPost, isFirstPost, updateUserXPAndStreak, getBannedWords, containsBannedWord, getWeeklyPostCount, getDailyPostCount } from "@/lib/services/posts";
import ImageCropper from "@/components/ImageCropper";
import LoadingSpinner from "@/components/LoadingSpinner";
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

  const tagsRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Set defaults from profile
  useEffect(() => {
    if (!profile) return;
    if (!mode && profile.mainMode) setMode(profile.mainMode);
    if (!postRegion && profile.region) setPostRegion(profile.region);
  }, [profile, mode, postRegion]);

  // Pick up image from BottomNav file picker (sessionStorage)
  useEffect(() => {
    const stored = sessionStorage.getItem("post_image");
    if (!stored) return;
    sessionStorage.removeItem("post_image");
    setCropSrc(stored);
  }, []);

  const handleModeSelect = (id: string) => {
    setMode(id);
    // Auto-scroll to tags after mode selection
    setTimeout(() => {
      tagsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

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
      const bannedWords = await getBannedWords();
      const matched = containsBannedWord(content.trim(), bannedWords);
      if (matched) {
        alert("Your post contains inappropriate language. Please revise it.");
        setSubmitting(false);
        return;
      }

      const firstPost = await isFirstPost(user.uid);

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

      // Post XP: 5 XP per post, up to 3 posts per day
      const dailyCount = await getDailyPostCount(user.uid);
      if (dailyCount <= POST_XP_DAILY_MAX) {
        totalXpGain += POST_XP;
      }

      if (!alreadyPostedToday) {
        const weeklyCount = await getWeeklyPostCount(user.uid);
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
      {/* Region picker modal */}
      {showRegionPicker && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowRegionPicker(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl max-h-[50dvh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-sm">Select Region</h3>
              <button onClick={() => setShowRegionPicker(false)} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2" style={{ scrollbarWidth: "none" }}>
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => { setPostRegion(r); setShowRegionPicker(false); }}
                  className={`py-2 px-2 rounded-xl text-xs font-medium text-center transition-all active:scale-[0.97] ${
                    postRegion === r ? "bg-accent-orange text-white" : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {/* Day picker modal — select date to compute day number */}
      {showDayPicker && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowDayPicker(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-sm">Select Date</h3>
              <button onClick={() => setShowDayPicker(false)} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center">&times;</button>
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

        {/* Visibility — above preview */}
        <div className="px-4 mt-3 flex gap-1.5">
          <button
            onClick={() => setVisibility("public")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all active:scale-[0.98] ${
              visibility === "public" ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
            }`}
          >
            <IconGlobe size={14} />
            <span className="text-xs font-bold">Public</span>
          </button>
          <button
            onClick={() => setVisibility("private")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all active:scale-[0.98] ${
              visibility === "private" ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
            }`}
          >
            <IconLock size={14} />
            <span className="text-xs font-bold">Private</span>
          </button>
        </div>

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
                {todayStr} · {modeInfo && <FocusModeIcon modeId={modeInfo.id} size={12} className="inline-block align-middle mr-0.5" />}{modeInfo?.label || "Select a mode"}
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

          {/* Image area — tappable to select/change */}
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
              <div className={`w-full aspect-[4/3] bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 relative`}>
                <IconCamera size={28} className="text-white/40" />
                <p className="text-white/40 text-xs font-medium">Tap to add photo (required)</p>
              </div>
            )}
            {visibility === "private" && (
              <div className="absolute top-2 left-2 bg-black/50 text-white rounded-full px-3 py-1 flex items-center gap-1.5 text-xs">
                <IconLock size={18} />
              </div>
            )}
          </div>

          {/* Content + tags — matches PostCard */}
          <div className="p-3">
            {content.trim() && (
              <p className="text-sm text-gray-700">{content}</p>
            )}
            {tags.length > 0 && (
              <p className="text-xs text-accent-orange mt-1.5">{tags.join(" ")}</p>
            )}
          </div>

          {/* Actions placeholder — matches PostCard */}
          <div className="flex items-center px-3 pb-3">
            <div className="flex items-center gap-1 text-gray-300">
              <IconKangaroo size={18} />
              <span className="text-sm">0</span>
            </div>
          </div>
        </div>

        {/* ── Input controls below preview ── */}

        {/* Diary input */}
        <div className="px-4 mt-3">
          <textarea
            value={content}
            onChange={(e) => setContent(sanitize(e.target.value, /[^\x20-\x7E\n]/g))}
            maxLength={POST_CONTENT_MAX}
            rows={3}
            placeholder="What happened today? (English only)"
            className="w-full border border-forest-light/30 bg-forest-light/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange resize-none placeholder-white/30"
          />
          <div className="flex items-center justify-between">
            <AsciiWarn show={showWarn} />
            <p className="text-[10px] text-white/30 ml-auto">{content.length}/{POST_CONTENT_MAX}</p>
          </div>
        </div>

        {/* Mode selection */}
        <div className="px-4 mt-3">
          <div className="flex gap-1.5 mb-1.5">
            {FOCUS_MODES.filter((m) => ["english", "skill", "adventure"].includes(m.id)).map((m) => (
              <button
                key={m.id}
                onClick={() => handleModeSelect(m.id)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-full transition-all active:scale-[0.97] text-xs font-medium ${
                  mode === m.id ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
                }`}
              >
                <FocusModeIcon modeId={m.id} size={14} />
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {FOCUS_MODES.filter((m) => ["work", "chill"].includes(m.id)).map((m) => (
              <button
                key={m.id}
                onClick={() => handleModeSelect(m.id)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-full transition-all active:scale-[0.97] text-xs font-medium ${
                  mode === m.id ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
                }`}
              >
                <FocusModeIcon modeId={m.id} size={14} />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        {mode && (
          <div className="px-4 mt-3" ref={tagsRef}>
            <p className="text-xs font-bold text-white/50 mb-1.5">Tags <span className="text-white/30 font-normal">({tags.length}/{HASHTAG_MAX})</span></p>
            <div className="flex flex-wrap gap-1.5">
              {[...(HASHTAG_SUGGESTIONS[mode] || []), ...tags.filter((t) => !(HASHTAG_SUGGESTIONS[mode] || []).includes(t))].map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs transition-all active:scale-[0.97] ${
                    tags.includes(tag) ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 mt-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && addCustomTag()}
                placeholder="Custom tag"
                maxLength={20}
                className="flex-1 border border-forest-light/30 bg-forest-light/10 text-white rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-orange placeholder-white/30"
              />
              <button
                onClick={addCustomTag}
                disabled={!customTag.trim() || tags.length >= HASHTAG_MAX}
                className="px-3 py-1.5 bg-white text-forest-mid rounded-full text-xs font-bold disabled:opacity-30"
              >
                + Add
              </button>
            </div>
          </div>
        )}

        {/* Spacer for bottom */}
        <div className="h-8" />
      </div>
    </div>
  );
}
