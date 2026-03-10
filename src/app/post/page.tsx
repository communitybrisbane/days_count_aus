"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { FOCUS_MODES, GRADIENTS } from "@/lib/constants";
import { getDayCount, calculateLevel } from "@/lib/utils";
import { createPost, isFirstPost, updateUserXPAndStreak, getBannedWords, containsBannedWord } from "@/lib/services/posts";
import ImageCropper from "@/components/ImageCropper";
import BottomNav from "@/components/layout/BottomNav";
import LoadingSpinner from "@/components/LoadingSpinner";
import XPToast from "@/components/XPToast";
import LevelUpAnimation from "@/components/LevelUpAnimation";
import { IconCamera, IconGlobe, IconLock, IconBoomerang, IconHeart, FocusModeIcon } from "@/components/icons";
import Avatar from "@/components/Avatar";

export default function PostPage() {
  const { user, profile, loading } = useAuthGuard();
  const { refreshProfile } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState(profile?.mainMode || "");
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

  const createdAtDate = useMemo(() => {
    const ca = profile?.createdAt as { toDate?: () => Date } | undefined;
    return ca?.toDate?.() ?? null;
  }, [profile]);

  const dayCount = useMemo(() => {
    if (!profile) return { label: "D", number: 0 };
    return getDayCount(profile.status || "pre-departure", profile.departureDate || "", profile.returnStartDate, createdAtDate);
  }, [profile, createdAtDate]);

  // Set default mode from profile.mainMode once loaded
  useEffect(() => {
    if (profile?.mainMode && !mode) setMode(profile.mainMode);
  }, [profile, mode]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (blob: Blob) => {
    setImageBlob(blob);
    setImagePreview(URL.createObjectURL(blob));
    setCropSrc("");
  };

  const handleSubmit = async () => {
    if (!user || !profile || !mode || !content.trim()) return;

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
      });

      let xpGain = 50;
      if (firstPost) xpGain += 100;

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      let newStreak = 1;
      if (profile.lastPostAt) {
        const lastPostDate = new Date(profile.lastPostAt);
        const lastPostStr = lastPostDate.toISOString().slice(0, 10);
        if (lastPostStr === todayStr) {
          newStreak = profile.currentStreak ?? 1;
        } else {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().slice(0, 10);
          if (lastPostStr === yesterdayStr) {
            newStreak = (profile.currentStreak ?? 0) + 1;
          }
        }
      }

      if (newStreak > 0 && newStreak % 7 === 0) {
        xpGain += 100;
      }

      const prevLevel = calculateLevel(profile.totalXP);
      await updateUserXPAndStreak(user.uid, xpGain, newStreak);
      await refreshProfile();

      setXpGained(xpGain);
      setShowXP(true);

      const newLevel = calculateLevel(profile.totalXP + xpGain);
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

  return (
    <div className="min-h-dvh pb-20 flex flex-col">
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

      {/* Progress bar */}
      <div className="px-5 pt-2 pb-1">
        <div className="flex items-center gap-1.5">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                s <= step ? "bg-aussie-gold" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-gray-400">Setup</span>
          <span className="text-[10px] text-gray-400">Diary & Post</span>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden min-h-0 flex flex-col">
        {/* ===== STEP 1: Photo + Mode + Visibility（一画面に収める） ===== */}
        <div
          className={`absolute inset-0 px-5 pt-2 flex flex-col min-h-0 transition-all duration-300 ease-out ${
            step === 1 ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
          }`}
          style={{ scrollbarWidth: "none", overflow: "hidden" }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Mode selection */}
          <p className="text-xs font-bold text-gray-500 mb-1">Focus Mode</p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {FOCUS_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full border-2 whitespace-nowrap transition-all active:scale-[0.97] ${
                  mode === m.id
                    ? "border-aussie-gold bg-amber-50"
                    : "border-gray-100 bg-gray-50"
                }`}
              >
                <FocusModeIcon modeId={m.id} size={16} />
                <span className="text-xs font-medium text-gray-700">{m.label}</span>
              </button>
            ))}
          </div>

          {/* Visibility toggle */}
          <p className="text-xs font-bold text-gray-500 mt-3 mb-1">Visibility</p>
          <div className="flex gap-1.5">
            <button
              onClick={() => setVisibility("public")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 transition-all active:scale-[0.98] ${
                visibility === "public"
                  ? "border-aussie-gold bg-amber-50"
                  : "border-gray-100 bg-gray-50"
              }`}
            >
              <IconGlobe size={16} />
              <span className="text-xs font-bold">Public</span>
            </button>
            <button
              onClick={() => setVisibility("private")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 transition-all active:scale-[0.98] ${
                visibility === "private"
                  ? "border-aussie-gold bg-amber-50"
                  : "border-gray-100 bg-gray-50"
              }`}
            >
              <IconLock size={16} />
              <span className="text-xs font-bold">Private</span>
            </button>
          </div>

          {/* Preview card — 正方形を大きくしてフッター上の余白を減らす */}
          <div className="mt-3 mb-2 flex-shrink-0 flex flex-col items-center">
            <div className="w-full max-w-[300px] rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white">
              <div className="flex items-center gap-2 p-2">
                <Avatar
                  photoURL={profile.photoURL}
                  displayName={profile.displayName}
                  uid={user?.uid || ""}
                  size={28}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{profile.displayName}</p>
                  <p className="text-[10px] text-gray-400 truncate">
                    Today · {modeInfo?.description || "..."}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {profile.region && (
                    <span className="text-[9px] bg-ocean-blue/10 text-ocean-blue px-1.5 py-0.5 rounded-full font-medium">
                      {profile.region}
                    </span>
                  )}
                  <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full text-gray-500">
                    {dayCount.number > 0 ? `D+${dayCount.number}` : `D${dayCount.number}`}
                  </span>
                </div>
              </div>

              <div className="relative cursor-pointer flex justify-center" onClick={() => fileInputRef.current?.click()}>
                <div className="w-full aspect-square">
                  {imagePreview ? (
                    <div className="relative group w-full h-full">
                      <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 transition-colors flex items-center justify-center">
                        <span className="text-white/0 group-active:text-white/80 transition-colors text-[10px] font-bold">Tap to change</span>
                      </div>
                    </div>
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${gradient} opacity-50 flex flex-col items-center justify-center gap-2`}>
                      <IconCamera size={20} className="text-black" />
                      <p className="text-black text-xs font-bold">Tap to add photo (optional)</p>
                    </div>
                  )}
                </div>
                {visibility === "private" && (
                  <div className="absolute top-1 left-1 bg-black/50 text-white rounded-full p-1">
                    <IconLock size={10} />
                  </div>
                )}
              </div>

              <div className="px-2 py-1.5 flex items-center justify-between">
                <p className="text-[10px] text-gray-400 italic truncate flex-1">Your diary text will appear here...</p>
                <span className="text-[10px] text-gray-300 flex items-center gap-0.5 shrink-0"><IconHeart size={12} /> 0</span>
              </div>
            </div>
          </div>

          {/* Next button */}
          <button
            disabled={!mode}
            onClick={() => setStep(2)}
            className="w-full py-2.5 text-sm font-bold text-white bg-aussie-gold rounded-xl disabled:opacity-40 active:scale-[0.98] mb-2"
          >
            Next — Write diary →
          </button>
        </div>

        {/* ===== STEP 2: Diary + Submit ===== */}
        <div
          className={`absolute inset-0 px-5 pt-2 flex flex-col transition-all duration-300 ease-out ${
            step === 2 ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
          }`}
        >
          <h2 className="text-xl font-bold mb-1">Write your diary</h2>
          <p className="text-sm text-gray-400 mb-3">Today&apos;s log — {modeInfo?.label}</p>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={400}
            rows={8}
            placeholder="What happened today?"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aussie-gold resize-none"
          />
          <p className="text-[10px] text-gray-300 text-right mb-3">{content.length}/400</p>

          <div className="flex gap-3 mt-auto pb-2">
            <button
              onClick={() => setStep(1)}
              className="py-3 px-5 text-sm text-gray-500 border border-gray-200 rounded-xl active:scale-[0.98]"
            >
              ← Back
            </button>
            <button
              disabled={!content.trim() || submitting}
              onClick={handleSubmit}
              className="flex-1 py-3.5 text-sm font-bold text-white bg-aussie-gold rounded-xl disabled:opacity-50 active:scale-[0.98]"
            >
              {submitting ? "Posting..." : <span className="flex items-center justify-center gap-1.5">Post <IconBoomerang size={16} className="text-white" /></span>}
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
