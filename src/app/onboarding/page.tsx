"use client";

import { useState, useEffect, useRef } from "react";
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

type Phase = "pre-departure" | "in-australia" | "post-return";

export default function OnboardingPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const { showWarn, sanitize } = useAsciiInput();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [phase, setPhase] = useState<Phase>("in-australia");
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

  const needsDate = phase === "pre-departure" || phase === "in-australia";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !nickname.trim() || !mainMode || nicknameError) return;
    if (needsDate && !departureDate) return;

    setSubmitting(true);
    try {
      const taken = await isNicknameTaken(nickname.trim());
      if (taken) { setNicknameError("Already taken"); setSubmitting(false); return; }

      let photoURL = "";
      if (photoBlob) {
        const imgRef = ref(storage, `avatars/${user.uid}.jpg`);
        await uploadBytes(imgRef, photoBlob, { contentType: "image/jpeg" });
        photoURL = await getDownloadURL(imgRef);
      }

      const today = getTodayStr();

      // Clean up partial doc from previous failed attempt
      const existingDoc = await getDoc(doc(db, "users", user.uid));
      if (existingDoc.exists()) {
        await deleteDoc(doc(db, "users", user.uid));
      }

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: nickname.trim(),
        photoURL,
        status: phase,
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aussie-gold" />
      </div>
    );
  }

  const canSubmit = nickname.trim() && !nicknameError && mainMode && (!needsDate || departureDate) && !submitting;

  return (
    <div className="min-h-dvh bg-white px-6 py-6 flex flex-col">
      <AsciiWarn show={showWarn} />
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropSrc("")}
          cropShape="round"
          outputSize={AVATAR_SIZE}
        />
      )}

      <h1 className="text-xl font-bold text-center mb-5">Set up your profile</h1>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-6">
        {/* Row 1: Photo + Nickname */}
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="relative shrink-0">
            {photoPreview ? (
              <img src={photoPreview} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-aussie-gold" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                <span className="text-xl text-gray-400">+</span>
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 text-base bg-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm border border-gray-100 text-gray-600 font-medium">
              +
            </span>
          </button>
          <div className="flex-1">
            <input
              type="text"
              maxLength={NICKNAME_MAX}
              value={nickname}
              onChange={(e) => setNickname(sanitize(e.target.value, /[^a-zA-Z0-9_]/g))}
              placeholder="Nickname (a-z, 0-9, _) *"
              className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aussie-gold ${
                nicknameError ? "border-red-400" : "border-gray-200"
              }`}
              required
            />
            {nicknameError && <p className="text-[11px] text-red-400 mt-1">{nicknameError}</p>}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
        </div>

        {/* Row 2: Phase (horizontal pills) */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Status <span className="text-red-400">*</span></p>
          <div className="flex gap-2">
            {([
              { value: "pre-departure" as Phase, label: "Before" },
              { value: "in-australia" as Phase, label: "In AUS" },
              { value: "post-return" as Phase, label: "Returned" },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPhase(opt.value)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  phase === opt.value
                    ? "bg-aussie-gold text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Date picker (conditional) */}
        {phase === "pre-departure" && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Departure date <span className="text-red-400">*</span></p>
            <input
              type="date"
              lang="en"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aussie-gold"
              required
            />
          </div>
        )}
        {phase === "in-australia" && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">When did you arrive? <span className="text-red-400">*</span></p>
            <input
              type="date"
              lang="en"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aussie-gold"
              required
            />
          </div>
        )}
        {phase === "post-return" && (
          <p className="text-sm text-gray-400 bg-gray-50 px-4 py-3 rounded-xl">
            Today starts as R+1
          </p>
        )}

        {/* Row 4: Focus Mode — grid layout */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Focus <span className="text-red-400">*</span></p>
          <div className="grid grid-cols-3 gap-2">
            {FOCUS_MODES.map((mode) => {
              const isWH = mode.id === "enjoying" || mode.id === "challenging";
              return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setMainMode(mode.id)}
                className={`py-2.5 rounded-xl text-xs font-medium border transition-all ${
                  mainMode === mode.id
                    ? isWH ? "border-aussie-gold bg-amber-50 font-bold" : "border-ocean-blue bg-blue-50 font-bold"
                    : "border-gray-200 bg-white"
                }`}
              >
                {mode.description}
              </button>
              );
            })}
          </div>
        </div>

        {/* Row 5: Region — grid layout */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Region <span className="text-gray-300 text-[10px]">optional</span></p>
          <div className="grid grid-cols-3 gap-2">
            {REGIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegion(region === r ? "" : r)}
                className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                  region === r
                    ? "bg-aussie-gold text-white border-aussie-gold"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Row 6: Goal */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Goal <span className="text-gray-300 text-[10px]">optional</span></p>
          <input
            type="text"
            maxLength={GOAL_MAX}
            value={goal}
            onChange={(e) => setGoal(sanitize(e.target.value))}
            placeholder="Your goal for this journey"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aussie-gold"
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-aussie-gold text-white font-bold py-3.5 rounded-2xl disabled:opacity-40 transition-opacity active:scale-[0.98] mb-2"
        >
          {submitting ? "..." : "Get Started"}
        </button>
      </form>
    </div>
  );
}
