"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { FOCUS_MODES, REGIONS, AVATAR_SIZE, NICKNAME_MAX, GOAL_MAX } from "@/lib/constants";
import { getTodayStr } from "@/lib/utils";
import { isNicknameTaken } from "@/lib/validators";
import { joinOfficialGroup } from "@/lib/groups";
import ImageCropper from "@/components/ImageCropper";
import AsciiWarn from "@/components/AsciiWarn";
import { useAsciiInput } from "@/hooks/useAsciiInput";
import { FocusModeIcon } from "@/components/icons";

type Phase = "pre-departure" | "in-australia" | "post-return";

const TOTAL_STEPS = 6;

export default function OnboardingPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const { showWarn, sanitize } = useAsciiInput();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [phase, setPhase] = useState<Phase | "">("");
  const [departureDate, setDepartureDate] = useState("");
  const [mainMode, setMainMode] = useState("");
  const [region, setRegion] = useState("");
  const [goal, setGoal] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [cropSrc, setCropSrc] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && profile) router.replace("/home");
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!nickname.trim()) { setNicknameError(""); return; }
    const t = setTimeout(async () => {
      const taken = await isNicknameTaken(nickname.trim());
      setNicknameError(taken ? "Already taken" : "");
    }, 500);
    return () => clearTimeout(t);
  }, [nickname]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (blob: Blob) => {
    setPhotoBlob(blob);
    setPhotoPreview(URL.createObjectURL(blob));
    setCropSrc("");
  };

  const goNext = useCallback(() => {
    // Skip date step if post-return
    if (step === 2 && phase === "post-return") {
      setStep(4);
    } else {
      setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    }
  }, [step, phase]);

  const goBack = useCallback(() => {
    // Skip date step going back if post-return
    if (step === 4 && phase === "post-return") {
      setStep(2);
    } else {
      setStep((s) => Math.max(s - 1, 1));
    }
  }, [step, phase]);

  const handleSubmit = async () => {
    if (!user || !nickname.trim() || !mainMode || nicknameError) return;
    const needsDate = phase === "pre-departure" || phase === "in-australia";
    if (needsDate && !departureDate) return;

    setSubmitting(true);
    try {
      const taken = await isNicknameTaken(nickname.trim());
      if (taken) { setNicknameError("Already taken"); setStep(1); setSubmitting(false); return; }

      let photoURL = "";
      if (photoBlob) {
        const imgRef = ref(storage, `avatars/${user.uid}.jpg`);
        await uploadBytes(imgRef, photoBlob, { contentType: "image/jpeg" });
        photoURL = await getDownloadURL(imgRef);
      }

      const today = getTodayStr();

      const existingDoc = await getDoc(doc(db, "users", user.uid));
      if (existingDoc.exists()) {
        await deleteDoc(doc(db, "users", user.uid));
      }

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: nickname.trim(),
        photoURL,
        status: phase || "in-australia",
        totalXP: 0,
        currentStreak: 0,
        lastPostAt: "",
        departureDate: phase === "post-return" ? today : departureDate,
        returnStartDate: phase === "post-return" ? today : "",
        mainMode,
        region: region.trim(),
        goal: goal.trim(),
        isPro: false,
        dailyLikeCount: 0,
        lastLikeDate: "",
        groupIds: [],
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "users", user.uid, "private", "config"), {
        blockedUsers: [],
        fcmToken: "",
      });
      await joinOfficialGroup(user.uid, mainMode);

      await refreshProfile();
      router.replace("/home");
    } catch (error) {
      console.error("Onboarding failed:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-orange" />
      </div>
    );
  }

  // Progress bar
  const progress = step / TOTAL_STEPS;

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropSrc("")}
          cropShape="round"
          outputSize={AVATAR_SIZE}
        />
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

      {/* Header: back + progress */}
      <div className="shrink-0 px-4 pt-3 pb-2" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
        <div className="flex items-center gap-3 mb-3">
          {step > 1 ? (
            <button onClick={goBack} className="w-10 h-10 flex items-center justify-center text-gray-400 active:text-gray-700">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 4L7 10L13 16" />
              </svg>
            </button>
          ) : (
            <div className="w-10 h-10" />
          )}
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-orange rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-300 w-10 text-right">{step}/{TOTAL_STEPS}</span>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col px-6">

        {/* Step 1: Photo + Nickname */}
        {step === 1 && (
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-bold mb-1">What should we call you?</h2>
            <p className="text-sm text-gray-400 mb-8">Pick a nickname and photo</p>

            <div className="flex flex-col items-center gap-4 mb-8">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="relative">
                {photoPreview ? (
                  <img src={photoPreview} alt="" className="w-24 h-24 rounded-full object-cover border-2 border-accent-orange" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                    <span className="text-2xl text-gray-400">+</span>
                  </div>
                )}
                <span className="absolute -bottom-1 -right-1 text-sm bg-white rounded-full w-7 h-7 flex items-center justify-center shadow border border-gray-100 text-gray-600 font-medium">+</span>
              </button>
            </div>

            <div className="mb-2">
              <input
                type="text"
                maxLength={NICKNAME_MAX}
                value={nickname}
                onChange={(e) => setNickname(sanitize(e.target.value, /[^a-zA-Z0-9_]/g))}
                placeholder="Nickname (a-z, 0-9, _)"
                className={`w-full border rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange ${
                  nicknameError ? "border-red-400" : "border-gray-200"
                }`}
              />
              <AsciiWarn show={showWarn} />
              {nicknameError && <p className="text-[11px] text-red-400 mt-1">{nicknameError}</p>}
            </div>

            <div className="flex-1" />
            <button
              onClick={goNext}
              disabled={!nickname.trim() || !!nicknameError}
              className="w-full bg-accent-orange text-white font-bold py-3.5 rounded-2xl disabled:opacity-30 active:scale-[0.98] mb-4"
            >
              Next
            </button>
          </div>
        )}

        {/* Step 2: Status */}
        {step === 2 && (
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-bold mb-1">Where are you now?</h2>
            <p className="text-sm text-gray-400 mb-8">Select your current status</p>

            <div className="flex flex-col gap-3">
              {([
                { value: "pre-departure" as Phase, label: "Before departure", desc: "Haven't left yet" },
                { value: "in-australia" as Phase, label: "In Australia", desc: "Currently on working holiday" },
                { value: "post-return" as Phase, label: "Returned home", desc: "Back from Australia" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setPhase(opt.value); goNext(); }}
                  className={`w-full text-left px-5 py-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                    phase === opt.value
                      ? "border-accent-orange bg-accent-orange/5"
                      : "border-gray-100 bg-white"
                  }`}
                >
                  <p className="font-bold text-sm">{opt.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Date */}
        {step === 3 && (
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-bold mb-1">
              {phase === "pre-departure" ? "When do you leave?" : "When did you arrive?"}
            </h2>
            <p className="text-sm text-gray-400 mb-8">
              {phase === "pre-departure" ? "Your departure date" : "Your arrival date in Australia"}
            </p>

            <input
              type="date"
              lang="en"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange"
            />

            <div className="flex-1" />
            <button
              onClick={goNext}
              disabled={!departureDate}
              className="w-full bg-accent-orange text-white font-bold py-3.5 rounded-2xl disabled:opacity-30 active:scale-[0.98] mb-4"
            >
              Next
            </button>
          </div>
        )}

        {/* Step 4: Focus Mode */}
        {step === 4 && (
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-bold mb-1">What&apos;s your focus?</h2>
            <p className="text-sm text-gray-400 mb-8">Pick your main mode</p>

            <div className="flex flex-col gap-3">
              {FOCUS_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => { setMainMode(mode.id); goNext(); }}
                  className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                    mainMode === mode.id
                      ? "border-accent-orange bg-accent-orange/5"
                      : "border-gray-100 bg-white"
                  }`}
                >
                  <FocusModeIcon modeId={mode.id} size={24} />
                  <div className="text-left">
                    <p className="font-bold text-sm">{mode.label}</p>
                    <p className="text-xs text-gray-400">{mode.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Region (optional) */}
        {step === 5 && (
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-bold mb-1">Where are you based?</h2>
            <p className="text-sm text-gray-400 mb-8">Optional — shown on your profile</p>

            <div className="grid grid-cols-3 gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => { setRegion(r); goNext(); }}
                  className={`py-3 rounded-xl text-xs font-medium border-2 transition-all active:scale-[0.97] ${
                    region === r
                      ? "bg-accent-orange text-white border-accent-orange"
                      : "bg-white text-gray-600 border-gray-100"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="flex-1" />
            <button
              onClick={goNext}
              className="w-full text-gray-400 font-medium py-3.5 active:text-gray-600 mb-4"
            >
              Skip
            </button>
          </div>
        )}

        {/* Step 6: Goal (optional) + Submit */}
        {step === 6 && (
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-bold mb-1">Set a goal</h2>
            <p className="text-sm text-gray-400 mb-8">Optional — keep yourself motivated</p>

            <input
              type="text"
              maxLength={GOAL_MAX}
              value={goal}
              onChange={(e) => setGoal(sanitize(e.target.value))}
              placeholder="e.g. Improve my English to IELTS 7.0"
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange"
            />
            <AsciiWarn show={showWarn} />

            <div className="flex-1" />
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-accent-orange text-white font-bold py-3.5 rounded-2xl disabled:opacity-40 active:scale-[0.98] mb-2"
            >
              {submitting ? "Setting up..." : "Get Started"}
            </button>
            <button
              onClick={() => { setGoal(""); handleSubmit(); }}
              disabled={submitting}
              className="w-full text-gray-400 font-medium py-2 active:text-gray-600 mb-4"
            >
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
