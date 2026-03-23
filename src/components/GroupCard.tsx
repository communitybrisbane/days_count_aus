"use client";

import { useState } from "react";
import Link from "next/link";
import { doc, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FOCUS_MODES, MAX_GROUP_MEMBERS, resolveMode } from "@/lib/constants";
import { FocusModeIcon } from "@/components/icons";
import type { Group } from "@/types";

function formatTime(timestamp: { toDate?: () => Date } | undefined): string {
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
  const modeInfo = FOCUS_MODES.find((m) => m.id === resolveMode(group.mode || ""));
  const isFull = !group.isOfficial && group.memberCount >= MAX_GROUP_MEMBERS;
  const isMember = group.memberIds?.includes(currentUserId || "");

  const [joining, setJoining] = useState(false);

  const showJoinButton = canJoin && !isMember && !isFull && !group.isOfficial;

  const handleJoinClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
      onJoined?.();
    } catch (e) {
      console.error("Join failed:", e);
    } finally {
      setJoining(false);
    }
  };

  return (
    <Link
      href={`/groups/${group.id}`}
      className="block card-material overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-4 min-h-[96px]">
        {group.iconUrl ? (
          <img src={group.iconUrl} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-forest-light/20 flex items-center justify-center shrink-0">
            <FocusModeIcon modeId={resolveMode(group.mode || "adventure")} size={26} className="text-forest-mid" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-sm truncate text-forest">{group.groupName}</p>
            {group.isOfficial && <span className="text-[10px] bg-accent-orange text-white px-1.5 py-0.5 rounded-full">Official</span>}
            {!group.isOfficial && leaderName && <span className="text-[10px] text-gray-400 shrink-0">by {leaderName}</span>}
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
            className="bg-gradient-to-br from-accent-orange to-accent-orange-dark text-white text-xs font-bold px-3 py-1.5 rounded-full shrink-0 disabled:opacity-50"
          >
            {joining ? "..." : "Join"}
          </button>
        )}
      </div>
      <div className="pb-1.5" />
    </Link>
  );
}
