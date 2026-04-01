"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, query, where, getDocs, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { FOCUS_MODES, GROUP_NAME_MAX, GROUP_CREATE_LEVEL, getMaxCommunitySlots } from "@/lib/constants";
import { calculateLevel } from "@/lib/utils";
import { isGroupNameTaken } from "@/lib/validators";
import { FocusModeIcon, IconCamera } from "@/components/icons";
import ImageCropper from "@/components/ImageCropper";
import { compressImage } from "@/lib/imageUtils";
import AsciiWarn from "@/components/AsciiWarn";
import { useAsciiInput } from "@/hooks/useAsciiInput";

export default function CreateGroupPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const { showWarn, sanitize } = useAsciiInput();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [groupName, setGroupName] = useState("");
  const [groupNameError, setGroupNameError] = useState("");
  const [mode, setMode] = useState("");
  const [goal, setGoal] = useState("");
  const [iconBlob, setIconBlob] = useState<Blob | null>(null);
  const [iconPreview, setIconPreview] = useState("");
  const [cropSrc, setCropSrc] = useState("");
  const [joinType, setJoinType] = useState<"open" | "friends">("open");
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Group name uniqueness check
  useEffect(() => {
    if (!groupName.trim()) {
      setGroupNameError("");
      return;
    }
    const timer = setTimeout(async () => {
      const taken = await isGroupNameTaken(groupName.trim());
      setGroupNameError(taken ? "This group name is already taken" : "");
    }, 500);
    return () => clearTimeout(timer);
  }, [groupName]);

  if (!profile || calculateLevel(profile.totalXP) < GROUP_CREATE_LEVEL) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh p-6">
        <p className="text-white/60">Reach Lv.{GROUP_CREATE_LEVEL} to create a group</p>
        <button onClick={() => router.back()} className="mt-4 text-accent-orange">
          Back
        </button>
      </div>
    );
  }

  const [isAlreadyLeader, setIsAlreadyLeader] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    async function checkLeader() {
      const q = query(
        collection(db, "groups"),
        where("creatorId", "==", user!.uid),
        where("isClosed", "==", false)
      );
      const snap = await getDocs(q);
      setIsAlreadyLeader(!snap.empty);
    }
    checkLeader();
  }, [user]);

  if (isAlreadyLeader) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh p-6">
        <p className="text-white/60">You can only lead 1 group</p>
        <p className="text-xs text-white/40 mt-1">Transfer or disband your current group first</p>
        <button onClick={() => router.back()} className="mt-4 text-accent-orange">
          Back
        </button>
      </div>
    );
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropComplete = (blob: Blob) => {
    setIconBlob(blob);
    setIconPreview(URL.createObjectURL(blob));
    setCropSrc("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupName.trim() || !mode || !iconBlob || !goal.trim() || groupNameError) return;

    setSubmitting(true);
    try {
      // Check group limit: count only non-mode groups that still exist
      const currentGroupIds = profile?.groupIds || [];
      const lvl = calculateLevel(profile?.totalXP || 0);
      const maxSlots = getMaxCommunitySlots(lvl);
      let communityCount = 0;
      await Promise.all(currentGroupIds.map(async (gid) => {
        try {
          const snap = await getDoc(doc(db, "groups", gid));
          if (snap.exists) {
            const g = snap.data();
            const isModeGroup = g?.isOfficial && !g?.iconUrl;
            if (!isModeGroup) communityCount++;
          }
        } catch {}
      }));
      if (communityCount >= maxSlots) {
        alert("Level up to unlock more community slots.");
        setSubmitting(false);
        return;
      }

      // Final check
      const taken = await isGroupNameTaken(groupName.trim());
      if (taken) {
        setGroupNameError("This group name is already taken");
        setSubmitting(false);
        return;
      }

      const groupRef = await addDoc(collection(db, "groups"), {
        mode,
        groupName: groupName.trim(),
        goal: goal.trim(),
        creatorId: user.uid,
        memberIds: [user.uid],
        memberCount: 1,
        iconUrl: "",
        joinType,
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        isClosed: false,
        isOfficial: false,
      });

      // Upload icon if selected
      if (iconBlob) {
        const iconRef = ref(storage, `groups/${groupRef.id}/icon.jpg`);
        await uploadBytes(iconRef, iconBlob, { contentType: "image/jpeg" });
        const url = await getDownloadURL(iconRef);
        await updateDoc(groupRef, { iconUrl: url });
      }

      // Add to user's groupIds
      await updateDoc(doc(db, "users", user.uid), {
        groupIds: arrayUnion(groupRef.id),
      });
      await refreshProfile();

      router.replace("/groups");
    } catch (e) {
      console.error("Failed to create group:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = groupName.trim() && mode && iconBlob && goal.trim() && !groupNameError && !submitting;

  return (
    <div className="h-dvh flex flex-col">
      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropSrc("")}
        />
      )}

      {/* Header */}
      <div className="shrink-0 flex items-center px-2 py-2 bg-forest/95 backdrop-blur-md border-b border-forest-light/20" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}>
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center text-white/70 active:text-white">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 4L7 10L13 16" />
          </svg>
        </button>
        <h1 className="text-sm font-bold text-white/90">Create Community</h1>
      </div>

      {!agreed ? (
        <div className="p-6 space-y-6">
          <div className="bg-forest-light/10 border border-forest-light/20 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white/90">Leader Guidelines</h2>

            <div className="space-y-3 text-sm text-white/70">
              <div className="flex gap-3">
                <span className="text-accent-orange font-bold shrink-0">1.</span>
                <p><span className="font-bold text-white/80">You are the leader.</span> You manage the group, set the tone, and keep things running.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-accent-orange font-bold shrink-0">2.</span>
                <p><span className="font-bold text-white/80">Kick members</span> who break the rules or disrupt the group. You have full control.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-accent-orange font-bold shrink-0">3.</span>
                <p><span className="font-bold text-white/80">Max 12 members</span> per group. Quality over quantity.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-accent-orange font-bold shrink-0">4.</span>
                <p><span className="font-bold text-white/80">Set clear goals & rules.</span> Members join based on what you write.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-accent-orange font-bold shrink-0">5.</span>
                <p><span className="font-bold text-white/80">1 group per leader.</span> You can lead 1 and join 1 other.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-accent-orange font-bold shrink-0">6.</span>
                <p><span className="font-bold text-white/80">Closing the group</span> removes it for everyone. This cannot be undone.</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setAgreed(true)}
            className="w-full bg-accent-orange text-white font-bold py-3 rounded-full active:scale-[0.98]"
          >
            I understand, let&apos;s create
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* Icon + Name — same row */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-14 h-14 shrink-0 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center overflow-hidden active:border-accent-orange transition-colors"
              >
                {iconPreview ? (
                  <img src={iconPreview} alt="Icon" className="w-full h-full object-cover" />
                ) : (
                  <IconCamera size={22} className="text-white/40" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex-1">
                <input
                  type="text"
                  maxLength={GROUP_NAME_MAX}
                  value={groupName}
                  onChange={(e) => setGroupName(sanitize(e.target.value))}
                  placeholder="Group Name *"
                  className={`w-full border rounded-lg px-3 py-2.5 bg-forest-light/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange placeholder-white/30 ${
                    groupNameError ? "border-red-400" : "border-forest-light/30"
                  }`}
                  required
                />
                <AsciiWarn show={showWarn} />
                {groupNameError ? (
                  <p className="text-[10px] text-red-400 mt-0.5">{groupNameError}</p>
                ) : (
                  <p className="text-[10px] text-white/30 mt-0.5 text-right">{groupName.length}/{GROUP_NAME_MAX}</p>
                )}
              </div>
            </div>

            {/* Mode — horizontal scroll */}
            <div>
              <p className="text-xs font-medium text-white/60 mb-1.5">Focus Mode *</p>
              <div className="flex gap-1.5">
                {FOCUS_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`flex-1 flex flex-col items-center py-2 rounded-xl text-xs transition-all ${
                      mode === m.id
                        ? "bg-accent-orange text-white"
                        : "bg-white text-forest-mid"
                    }`}
                  >
                    <FocusModeIcon modeId={m.id} size={20} />
                    <span className="mt-0.5">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Join Type — compact */}
            <div>
              <p className="text-xs font-medium text-white/60 mb-1.5">Who can join? *</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setJoinType("open")}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                    joinType === "open"
                      ? "bg-accent-orange text-white"
                      : "bg-white text-forest-mid"
                  }`}
                >
                  Anyone welcome
                </button>
                <button
                  type="button"
                  onClick={() => setJoinType("friends")}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                    joinType === "friends"
                      ? "bg-accent-orange text-white"
                      : "bg-white text-forest-mid"
                  }`}
                >
                  Friends only
                </button>
              </div>
            </div>

            {/* Goal */}
            <div>
              <p className="text-xs font-medium text-white/60 mb-1">Goal / Rules *</p>
              <textarea
                value={goal}
                onChange={(e) => setGoal(sanitize(e.target.value, /[^\x20-\x7E\n]/g))}
                maxLength={200}
                rows={2}
                placeholder="What's the group's goal or rules?"
                className="w-full border border-forest-light/30 bg-forest-light/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange resize-none placeholder-white/30"
              />
              <p className="text-[10px] text-white/30 mt-0.5 text-right">{goal.length}/200</p>
            </div>
          </div>

          {/* Fixed bottom button */}
          <div className="shrink-0 px-4 py-3 border-t border-forest-light/20" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full bg-accent-orange text-white font-bold py-3 rounded-full disabled:opacity-40 active:scale-[0.98]"
            >
              {submitting ? "Creating..." : "Create"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
