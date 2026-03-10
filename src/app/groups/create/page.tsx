"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { FOCUS_MODES } from "@/lib/constants";
import { calculateLevel } from "@/lib/utils";
import { isGroupNameTaken } from "@/lib/validators";
import { FocusModeIcon, IconCamera } from "@/components/icons";

export default function CreateGroupPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [groupName, setGroupName] = useState("");
  const [groupNameError, setGroupNameError] = useState("");
  const [mode, setMode] = useState("");
  const [goal, setGoal] = useState("");
  const [password, setPassword] = useState("");
  const [iconBlob, setIconBlob] = useState<Blob | null>(null);
  const [iconPreview, setIconPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  if (!profile || calculateLevel(profile.totalXP) < 5) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh p-6">
        <p className="text-gray-500">Reach Lv.5 to create a group</p>
        <button onClick={() => router.back()} className="mt-4 text-ocean-blue">
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
        <p className="text-gray-500">You can only lead 1 group</p>
        <p className="text-xs text-gray-400 mt-1">Transfer or disband your current group first</p>
        <button onClick={() => router.back()} className="mt-4 text-ocean-blue">
          Back
        </button>
      </div>
    );
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Resize to 256x256 for group icon
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d")!;
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 256, 256);
        canvas.toBlob((blob) => {
          if (blob) {
            setIconBlob(blob);
            setIconPreview(URL.createObjectURL(blob));
          }
        }, "image/jpeg", 0.85);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupName.trim() || !mode || groupNameError) return;

    setSubmitting(true);
    try {
      // Check group limit
      const currentGroupIds = profile?.groupIds || [];
      if (currentGroupIds.length >= 2) {
        alert("You can join up to 2 groups (+ official). Please leave one first.");
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
        password: password.trim(),
        creatorId: user.uid,
        memberIds: [user.uid],
        memberCount: 1,
        iconUrl: "",
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        isClosed: false,
        isOfficial: false,
      });

      // Upload icon if selected
      if (iconBlob) {
        const iconRef = ref(storage, `groups/${groupRef.id}/icon.jpg`);
        await uploadBytes(iconRef, iconBlob);
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

  return (
    <div className="min-h-dvh p-6">
      <h1 className="text-2xl font-bold mb-6">Create Community</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Group Icon */}
        <div className="flex flex-col items-center">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Group Icon
          </label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden active:border-aussie-gold transition-colors"
          >
            {iconPreview ? (
              <img src={iconPreview} alt="Icon" className="w-full h-full object-cover" />
            ) : (
              <IconCamera size={28} className="text-gray-400" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {iconPreview && (
            <button
              type="button"
              onClick={() => { setIconBlob(null); setIconPreview(""); }}
              className="text-xs text-gray-400 mt-1"
            >
              Remove
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Group Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            maxLength={30}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value.replace(/[^\x20-\x7E]/g, ""))}
            className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-aussie-gold ${
              groupNameError ? "border-red-400" : "border-gray-300"
            }`}
            required
          />
          {groupNameError ? (
            <p className="text-xs text-red-400 mt-1">{groupNameError}</p>
          ) : (
            <p className="text-xs text-gray-400 mt-1 text-right">{groupName.length}/30</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Focus Mode <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {FOCUS_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`flex flex-col items-center p-3 rounded-xl border-2 ${
                  mode === m.id ? "border-aussie-gold bg-amber-50" : "border-gray-200"
                }`}
              >
                <FocusModeIcon modeId={m.id} size={24} />
                <span className="text-xs text-gray-600">{m.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Goal / Memo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Goal / Rules
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value.replace(/[^\x20-\x7E\n]/g, ""))}
            maxLength={200}
            rows={3}
            placeholder="What's the group's goal or rules?"
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aussie-gold resize-none"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{goal.length}/200</p>
        </div>

        {/* Password (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-xs text-gray-400 font-normal">(optional — for private groups)</span>
          </label>
          <input
            type="text"
            maxLength={20}
            value={password}
            onChange={(e) => setPassword(e.target.value.replace(/[^\x20-\x7E]/g, ""))}
            placeholder="Leave empty for open group"
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aussie-gold"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !groupName.trim() || !mode || !!groupNameError}
          className="w-full bg-aussie-gold text-white font-bold py-3 rounded-full disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create"}
        </button>
      </form>
    </div>
  );
}
