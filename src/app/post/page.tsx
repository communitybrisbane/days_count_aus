"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { FOCUS_MODES, GRADIENTS, WEEKLY_XP, WEEK_STREAK_BONUS, WEEK_STREAK_MAX, FIRST_POST_BONUS, POST_CONTENT_MAX, HASHTAG_SUGGESTIONS, HASHTAG_MAX } from "@/lib/constants";
import { calculateLevel } from "@/lib/utils";
import { useDayCount } from "@/hooks/useDayCount";
import { createPost, isFirstPost, updateUserXPAndStreak, getBannedWords, containsBannedWord, getWeeklyPostCount } from "@/lib/services/posts";
import ImageCropper from "@/components/ImageCropper";
import LoadingSpinner from "@/components/LoadingSpinner";
import XPToast from "@/components/XPToast";
import LevelUpAnimation from "@/components/LevelUpAnimation";
import Avatar from "@/components/Avatar";
import { IconCamera, IconGlobe, IconLock, IconBoomerang, IconHeart, FocusModeIcon } from "@/components/icons";
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
  const [submitting, setSubmitting] = useState(false);
  const [xpGained, setXpGained] = useState(0);
  const [showXP, setShowXP] = useState(false);
  const [levelUpTo, setLevelUpTo] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const imgTapCountRef = useRef(0);
  const imgTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dayCount = useDayCount(profile ?? null);

  const tagsRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
    if (!user || !profile || !mode || !imageBlob) return;

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
        dayNumber: dayCount.number,
        visibility,
        imageBlob,
        tags,
        region: profile.region || "",
      });

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const alreadyPostedToday = profile.lastPostAt
        && new Date(profile.lastPostAt).toISOString().slice(0, 10) === todayStr;

      let totalXpGain = 0;
      let newStreak = 1;

      if (!alreadyPostedToday) {
        const weeklyCount = await getWeeklyPostCount(user.uid);
        const streakWeeks = Math.min(profile.weekStreak || 0, WEEK_STREAK_MAX);
        const baseXp = weeklyCount < 7 ? WEEKLY_XP[weeklyCount] : 0;
        const streakBonus = weeklyCount < 7 ? streakWeeks * WEEK_STREAK_BONUS : 0;
        totalXpGain = baseXp + streakBonus + (firstPost ? FIRST_POST_BONUS : 0);

        if (profile.lastPostAt) {
          const lastPostStr = new Date(profile.lastPostAt).toISOString().slice(0, 10);
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          if (lastPostStr === yesterday.toISOString().slice(0, 10)) {
            newStreak = (profile.currentStreak ?? 0) + 1;
          }
        }

        if (weeklyCount === 6) {
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Back button header */}
      <div
        className="shrink-0 flex items-center px-2 py-2 bg-forest/95 backdrop-blur-md border-b border-forest-light/20"
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
        <span className="text-white/70 text-sm font-medium">New Post</span>
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
                {todayStr} · {modeInfo && <FocusModeIcon modeId={modeInfo.id} size={12} className="inline-block align-middle mr-0.5" />}{modeInfo?.description || "Select a mode"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {profile.region && profile.showRegion !== false && (
                <span className="text-[10px] bg-forest-mid/10 text-forest-mid px-2 py-0.5 rounded-full font-medium">
                  {profile.region}
                </span>
              )}
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-500">
                {dayCount.number > 0 ? `D+${dayCount.number}` : `D${dayCount.number}`}
              </span>
            </div>
          </div>

          {/* Image or gradient card — tappable */}
          <div
            className="relative cursor-pointer"
            onClick={() => {
              if (!imagePreview) {
                fileInputRef.current?.click();
                return;
              }
              imgTapCountRef.current += 1;
              if (imgTapCountRef.current === 1) {
                imgTapTimerRef.current = setTimeout(() => {
                  if (imgTapCountRef.current === 1) fileInputRef.current?.click();
                  imgTapCountRef.current = 0;
                }, 300);
              } else {
                if (imgTapTimerRef.current) clearTimeout(imgTapTimerRef.current);
                imgTapCountRef.current = 0;
                setImageBlob(null);
                setImagePreview("");
              }
            }}
          >
            {imagePreview ? (
              <div className="relative group">
                <img src={imagePreview} alt="" className="w-full aspect-square object-cover" />
                <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="text-white/0 group-active:text-white/80 transition-colors text-[10px] font-bold">Tap: change / Double-tap: remove</span>
                </div>
              </div>
            ) : (
              <div className={`w-full aspect-[4/3] bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 relative`}>
                {content.trim() ? (
                  <p className="text-white text-center font-medium text-sm leading-relaxed px-6">
                    {content}
                  </p>
                ) : (
                  <>
                    <IconCamera size={28} className="text-white/40" />
                    <p className="text-white/40 text-xs font-medium">Tap to add photo</p>
                  </>
                )}
              </div>
            )}
            {visibility === "private" && (
              <div className="absolute top-2 left-2 bg-black/50 text-white rounded-full px-2 py-0.5 flex items-center gap-1 text-xs">
                <IconLock size={12} />
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
              <IconHeart size={18} />
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
            {FOCUS_MODES.filter((m) => m.id === "enjoying" || m.id === "challenging").map((m) => (
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
            {FOCUS_MODES.filter((m) => m.id !== "enjoying" && m.id !== "challenging").map((m) => (
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

        {/* Spacer for bottom button */}
        <div className="h-20" />
      </div>

      {/* Fixed bottom Post button */}
      <div className="shrink-0 px-4 pb-3 pt-2 bg-forest/95 backdrop-blur-md border-t border-forest-light/20" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}>
        <button
          disabled={!mode || !imageBlob || submitting}
          onClick={handleSubmit}
          className="w-full py-3.5 text-sm font-bold text-white bg-accent-orange rounded-xl disabled:opacity-40 active:scale-[0.98]"
        >
          {submitting ? "Posting..." : <span className="flex items-center justify-center gap-1.5">Post <IconBoomerang size={16} className="text-white" /></span>}
        </button>
      </div>
    </div>
  );
}
