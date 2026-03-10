"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { FOCUS_MODES } from "@/lib/constants";
import { getDayCount, calculateLevel } from "@/lib/utils";
import { createPost, isFirstPost, updateUserXPAndStreak, getBannedWords, containsBannedWord } from "@/lib/services/posts";
import ImageCropper from "@/components/ImageCropper";
import BottomNav from "@/components/layout/BottomNav";
import LoadingSpinner from "@/components/LoadingSpinner";
import XPToast from "@/components/XPToast";
import LevelUpAnimation from "@/components/LevelUpAnimation";
import { IconCamera, IconGlobe, IconLock, IconBoomerang, FocusModeIcon } from "@/components/icons";

type Step = 1 | 2 | 3 | 4;

export default function PostPage() {
  const { user, profile, loading } = useAuthGuard();
  const { refreshProfile } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
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

  const dayCount = useMemo(() => {
    if (!profile) return { label: "D", number: 0 };
    return getDayCount(profile.status, profile.departureDate, profile.returnStartDate);
  }, [profile]);

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
    // Auto-advance to step 2 after cropping
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!user || !profile || !mode || !content.trim()) return;

    setSubmitting(true);
    try {
      // Pre-submission banned word check
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
        phase: profile.status,
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
          // Same day — keep current streak
          newStreak = profile.currentStreak;
        } else {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().slice(0, 10);
          if (lastPostStr === yesterdayStr) {
            // Consecutive day
            newStreak = profile.currentStreak + 1;
          }
        }
      }

      if (newStreak > 0 && newStreak % 7 === 0) {
        xpGain += 100;
      }

      const prevLevel = calculateLevel(profile.totalXP);

      await updateUserXPAndStreak(user.uid, xpGain, newStreak);

      await refreshProfile();

      // Show XP toast
      setXpGained(xpGain);
      setShowXP(true);

      const newLevel = calculateLevel(profile.totalXP + xpGain);
      if (newLevel > prevLevel) {
        // Show level up after XP toast
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

  const canGoStep3 = !!mode;
  const canGoStep4 = !!content.trim();

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
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                s <= step ? "bg-aussie-gold" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-gray-400">Photo</span>
          <span className="text-[10px] text-gray-400">Mode</span>
          <span className="text-[10px] text-gray-400">Diary</span>
          <span className="text-[10px] text-gray-400">Post</span>
        </div>
      </div>

      {/* Step container with slide animation */}
      <div className="flex-1 relative overflow-hidden">
        {/* STEP 1: Photo */}
        <div
          className={`absolute inset-0 px-5 pt-4 transition-all duration-300 ease-out ${
            step === 1 ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
          }`}
        >
          <h2 className="text-xl font-bold mb-1">Pick a photo</h2>
          <p className="text-sm text-gray-400 mb-5">Square crop for your daily log</p>

          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full aspect-square object-cover rounded-2xl"
              />
              <button
                onClick={() => { setImageBlob(null); setImagePreview(""); }}
                className="absolute top-3 right-3 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-square border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center text-gray-400 active:border-aussie-gold active:text-aussie-gold transition-colors"
            >
              <IconCamera size={40} className="text-gray-400 mb-2" />
              <span className="text-sm">Tap to select photo</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setStep(2)}
              className="flex-1 py-3 text-sm text-gray-500 border border-gray-200 rounded-xl active:scale-[0.98]"
            >
              Skip photo
            </button>
            {imagePreview && (
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 text-sm font-bold text-white bg-aussie-gold rounded-xl active:scale-[0.98]"
              >
                Next →
              </button>
            )}
          </div>
        </div>

        {/* STEP 2: Focus Mode */}
        <div
          className={`absolute inset-0 px-5 pt-4 transition-all duration-300 ease-out ${
            step === 2 ? "translate-x-0 opacity-100"
              : step < 2 ? "translate-x-full opacity-0"
              : "-translate-x-full opacity-0"
          }`}
        >
          <h2 className="text-xl font-bold mb-1">Focus mode</h2>
          <p className="text-sm text-gray-400 mb-5">What did you focus on today?</p>

          <div className="grid grid-cols-2 gap-3">
            {FOCUS_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setStep(3); }}
                className={`flex flex-col items-center py-5 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                  mode === m.id
                    ? "border-aussie-gold bg-amber-50 shadow-sm"
                    : "border-gray-100 bg-gray-50"
                }`}
              >
                <FocusModeIcon modeId={m.id} size={30} className="mb-1" />
                <span className="text-sm font-medium text-gray-700">{m.label}</span>
                <span className="text-[10px] text-gray-400 mt-0.5">{m.description}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep(1)}
            className="mt-4 text-sm text-gray-400 active:text-gray-600"
          >
            ← Back
          </button>
        </div>

        {/* STEP 3: Diary */}
        <div
          className={`absolute inset-0 px-5 pt-4 transition-all duration-300 ease-out flex flex-col ${
            step === 3 ? "translate-x-0 opacity-100"
              : step < 3 ? "translate-x-full opacity-0"
              : "-translate-x-full opacity-0"
          }`}
        >
          <h2 className="text-xl font-bold mb-1">Write your diary</h2>
          <p className="text-sm text-gray-400 mb-4">Today&apos;s log</p>

          <div className="mb-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.replace(/[^\x20-\x7E\n]/g, ""))}
              maxLength={400}
              rows={6}
              placeholder="What happened today?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aussie-gold resize-none"
            />
            <p className="text-[10px] text-gray-300 text-right">{content.length}/400</p>
          </div>

          <div className="flex gap-3 mt-auto pb-2">
            <button
              onClick={() => setStep(2)}
              className="py-3 px-5 text-sm text-gray-500 border border-gray-200 rounded-xl active:scale-[0.98]"
            >
              ← Back
            </button>
            <button
              disabled={!canGoStep4}
              onClick={() => setStep(4)}
              className="flex-1 py-3 text-sm font-bold text-white bg-aussie-gold rounded-xl disabled:opacity-40 active:scale-[0.98]"
            >
              Next →
            </button>
          </div>
        </div>

        {/* STEP 4: Visibility + Submit */}
        <div
          className={`absolute inset-0 px-5 pt-4 transition-all duration-300 ease-out flex flex-col ${
            step === 4 ? "translate-x-0 opacity-100"
              : step < 4 ? "translate-x-full opacity-0"
              : "-translate-x-full opacity-0"
          }`}
        >
          <h2 className="text-xl font-bold mb-1">Who can see this?</h2>
          <p className="text-sm text-gray-400 mb-5">Choose visibility for your post</p>

          <div className="space-y-3 mb-6">
            <button
              onClick={() => setVisibility("public")}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                visibility === "public"
                  ? "border-aussie-gold bg-amber-50"
                  : "border-gray-100 bg-gray-50"
              }`}
            >
              <IconGlobe size={24} />
              <div className="text-left">
                <p className="font-bold text-sm">Public</p>
                <p className="text-xs text-gray-400">Everyone can see on Explore</p>
              </div>
            </button>
            <button
              onClick={() => setVisibility("private")}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                visibility === "private"
                  ? "border-aussie-gold bg-amber-50"
                  : "border-gray-100 bg-gray-50"
              }`}
            >
              <IconLock size={24} />
              <div className="text-left">
                <p className="font-bold text-sm">Only Me</p>
                <p className="text-xs text-gray-400">Private — only you can see</p>
              </div>
            </button>
          </div>

          {/* Preview summary */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-4">
            <p className="text-xs font-medium text-gray-400 mb-2">Preview</p>
            <div className="flex items-center gap-3">
              {imagePreview && (
                <img src={imagePreview} alt="" className="w-12 h-12 rounded-lg object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {mode && <FocusModeIcon modeId={mode} size={14} className="inline-block align-middle mr-1" />}
                  {FOCUS_MODES.find((m) => m.id === mode)?.label}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {content}
                </p>
              </div>
              <span className="text-xs text-gray-400">
                {visibility === "public" ? <IconGlobe size={14} className="text-gray-400" /> : <IconLock size={14} className="text-gray-400" />}
              </span>
            </div>
          </div>

          <div className="flex gap-3 mt-auto pb-2">
            <button
              onClick={() => setStep(3)}
              className="py-3 px-5 text-sm text-gray-500 border border-gray-200 rounded-xl active:scale-[0.98]"
            >
              ← Back
            </button>
            <button
              disabled={submitting}
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
