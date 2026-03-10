"use client";

import { useState } from "react";
import Link from "next/link";
import { doc, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FOCUS_MODES, MAX_GROUP_MEMBERS } from "@/lib/constants";
import { IconLock, FocusModeIcon } from "@/components/icons";
import type { Group } from "@/types";

function formatTime(timestamp: any): string {
  const date = timestamp?.toDate?.();
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

interface GroupCardProps {
  group: Group;
  currentUserId?: string;
  leaderName?: string;
  canJoin?: boolean;
  onJoined?: () => void;
}

export default function GroupCard({ group, currentUserId, leaderName, canJoin, onJoined }: GroupCardProps) {
  const modeInfo = FOCUS_MODES.find((m) => m.id === group.mode);
  const isFull = !group.isOfficial && group.memberCount >= MAX_GROUP_MEMBERS;
  const isMember = group.memberIds?.includes(currentUserId || "");
  const hasPassword = !!group.password;

  const [showPwModal, setShowPwModal] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [joining, setJoining] = useState(false);

  const showJoinButton = canJoin && !isMember && !isFull && !group.isOfficial;

  const performJoin = async () => {
    if (!currentUserId) return;
    setJoining(true);
    try {
      await updateDoc(doc(db, "groups", group.id), {
        memberIds: arrayUnion(currentUserId),
        memberCount: increment(1),
      });
      await updateDoc(doc(db, "users", currentUserId), {
        groupIds: arrayUnion(group.id),
      });
      setShowPwModal(false);
      onJoined?.();
    } catch (e) {
      console.error("Join failed:", e);
    } finally {
      setJoining(false);
    }
  };

  const handleJoinClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasPassword) {
      setPwInput("");
      setPwError("");
      setShowPwModal(true);
    } else {
      performJoin();
    }
  };

  const handlePwSubmit = () => {
    if (pwInput.trim() === group.password) {
      performJoin();
    } else {
      setPwError("Wrong password");
    }
  };

  return (
    <>
      <Link
        href={`/groups/${group.id}`}
        className="block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-4 min-h-[96px]">
          {group.iconUrl ? (
            <img src={group.iconUrl} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <FocusModeIcon modeId={group.mode || "challenging"} size={26} className="text-gray-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-sm truncate">{group.groupName}</p>
              {group.isOfficial && <span className="text-[10px] bg-aussie-gold text-white px-1.5 py-0.5 rounded-full">Official</span>}
              {!group.isOfficial && leaderName && <span className="text-[10px] text-gray-400 shrink-0">by {leaderName}</span>}
              {hasPassword && <IconLock size={12} className="text-gray-400 shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
              {modeInfo && (
                <span className="flex items-center gap-0.5">
                  <FocusModeIcon modeId={modeInfo.id} size={10} className="text-gray-400" />
                  {modeInfo.description}
                </span>
              )}
              <span>· {group.isOfficial ? `${group.memberCount} members` : `${group.memberCount}/${MAX_GROUP_MEMBERS}`}</span>
              {group.lastMessageAt && (
                <span className="ml-auto shrink-0">{formatTime(group.lastMessageAt)}</span>
              )}
            </div>
            {group.lastMessageText && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{group.lastMessageText}</p>
            )}
          </div>

          {/* Right side button */}
          {!group.isOfficial && isFull && (
            <span className="bg-red-100 text-red-500 text-xs font-bold px-2 py-1 rounded-full shrink-0">
              FULL
            </span>
          )}
          {showJoinButton && (
            <button
              onClick={handleJoinClick}
              disabled={joining}
              className="flex items-center gap-1 bg-aussie-gold text-white text-xs font-bold px-3 py-1.5 rounded-full shrink-0 disabled:opacity-50"
            >
              {hasPassword && <IconLock size={10} className="text-white" />}
              {joining ? "..." : "Join"}
            </button>
          )}
        </div>
        <div className="pb-1.5" />
      </Link>

      {/* Password modal */}
      {showPwModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowPwModal(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl p-6 z-50 max-w-sm mx-auto">
            <div className="flex items-center justify-center mb-2">
              <IconLock size={24} className="text-aussie-gold" />
            </div>
            <p className="text-center font-bold mb-1">Private Community</p>
            <p className="text-center text-sm text-gray-500 mb-4">Enter the password to join</p>
            <input
              type="text"
              value={pwInput}
              onChange={(e) => { setPwInput(e.target.value); setPwError(""); }}
              placeholder="Password"
              className={`w-full border rounded-xl px-4 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-aussie-gold ${pwError ? "border-red-400" : "border-gray-200"}`}
              onKeyDown={(e) => e.key === "Enter" && handlePwSubmit()}
              autoFocus
            />
            {pwError && <p className="text-xs text-red-400 text-center mt-1">{pwError}</p>}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowPwModal(false)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-full text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handlePwSubmit}
                disabled={!pwInput.trim() || joining}
                className="flex-1 bg-aussie-gold text-white py-2.5 rounded-full text-sm font-bold disabled:opacity-50"
              >
                {joining ? "Joining..." : "Join"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
