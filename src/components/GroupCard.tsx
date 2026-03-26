"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FOCUS_MODES, MAX_GROUP_MEMBERS, resolveMode } from "@/lib/constants";
import { FocusModeIcon, IconUsers } from "@/components/icons";
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
  showGoal?: boolean;
  hasUnread?: boolean;
}

export default function GroupCard({ group, currentUserId, leaderName, canJoin, onJoined, showGoal, hasUnread }: GroupCardProps) {
  const router = useRouter();
  const modeInfo = FOCUS_MODES.find((m) => m.id === resolveMode(group.mode || ""));
  const isModeGroup = group.isOfficial && !group.iconUrl;
  const isFull = group.memberCount >= MAX_GROUP_MEMBERS;
  const isMember = group.memberIds?.includes(currentUserId || "");

  const [joining, setJoining] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleJoinClick = async () => {
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
      setShowPreview(false);
      onJoined?.();
      router.push(`/groups/${group.id}`);
    } catch (e) {
      console.error("Join failed:", e);
    } finally {
      setJoining(false);
    }
  };

  const handleCardClick = () => {
    if (isMember) {
      router.push(`/groups/${group.id}`);
    } else {
      setShowPreview(true);
    }
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className="block bg-white cursor-pointer active:bg-gray-50 border-b border-gray-100"
      >
        <div className="flex items-center gap-3 px-4 py-3">
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
              {isModeGroup && <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full">Mode</span>}
              {group.isOfficial && !isModeGroup && <span className="text-[10px] bg-accent-orange text-white px-1.5 py-0.5 rounded-full">Official</span>}
              {!group.isOfficial && group.joinType === "friends" && <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">Friends only</span>}
              {!group.isOfficial && group.joinType !== "friends" && <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full shrink-0">Anyone</span>}
              {!group.isOfficial && leaderName && <span className="text-[10px] text-gray-400 shrink-0">by {leaderName}</span>}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
              {modeInfo && (
                <span className="flex items-center gap-0.5">
                  <FocusModeIcon modeId={modeInfo.id} size={10} className="text-gray-400" />
                  {modeInfo.label}
                </span>
              )}
              <span>· {group.isOfficial && !isModeGroup ? `${group.memberCount} members` : `${group.memberCount}/${MAX_GROUP_MEMBERS}`}</span>
              {group.lastMessageAt && (
                <span className="ml-auto shrink-0">{formatTime(group.lastMessageAt)}</span>
              )}
            </div>
            {showGoal && group.goal && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{group.goal}</p>
            )}
            {!showGoal && group.lastMessageText && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{group.lastMessageText}</p>
            )}
          </div>

          {hasUnread && (
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
          )}
          {!group.isOfficial && isFull && (
            <span className="bg-red-100 text-red-500 text-xs font-bold px-2 py-1 rounded-full shrink-0">
              FULL
            </span>
          )}
        </div>
      </div>

      {/* Group preview modal for non-members */}
      {showPreview && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowPreview(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl overflow-hidden max-w-sm mx-auto shadow-xl">
            <div className="flex flex-col items-center pt-6 pb-4 px-6">
              {group.iconUrl ? (
                <img src={group.iconUrl} alt="" className="w-20 h-20 rounded-full object-cover mb-3" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-forest-light/20 flex items-center justify-center mb-3">
                  <FocusModeIcon modeId={resolveMode(group.mode || "adventure")} size={40} className="text-forest-mid" />
                </div>
              )}
              <h3 className="font-bold text-lg text-forest text-center">{group.groupName}</h3>
              {leaderName && (
                <p className="text-xs text-gray-400 mt-0.5">by {leaderName}</p>
              )}
            </div>

            <div className="px-6 pb-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap text-sm text-gray-500">
                {!group.isOfficial && group.joinType === "friends" && (
                  <span className="bg-gray-200 text-gray-500 px-2.5 py-1 rounded-full text-xs">Friends only</span>
                )}
                {!group.isOfficial && group.joinType !== "friends" && (
                  <span className="bg-green-100 text-green-600 px-2.5 py-1 rounded-full text-xs">Anyone welcome</span>
                )}
                {modeInfo && (
                  <span className="flex items-center gap-1 bg-gray-100 px-2.5 py-1 rounded-full text-xs">
                    <FocusModeIcon modeId={modeInfo.id} size={12} />
                    {modeInfo.label}
                  </span>
                )}
                <span className="flex items-center gap-1 bg-gray-100 px-2.5 py-1 rounded-full text-xs">
                  <IconUsers size={12} />
                  {group.memberCount}/{MAX_GROUP_MEMBERS}
                </span>
              </div>
              {group.goal && (
                <p className="text-sm text-gray-600 leading-relaxed">{group.goal}</p>
              )}
            </div>

            <div className="px-6 pb-6 space-y-2">
              {isFull ? (
                <div className="w-full text-center py-3 text-sm font-bold text-red-400">
                  This community is full
                </div>
              ) : canJoin ? (
                <button
                  onClick={handleJoinClick}
                  disabled={joining}
                  className="w-full bg-gradient-to-br from-accent-orange to-accent-orange-dark text-white font-bold py-3 rounded-xl disabled:opacity-50 active:scale-[0.98]"
                >
                  {joining ? "Joining..." : "Join Community"}
                </button>
              ) : (
                <div className="w-full text-center py-3 text-sm text-gray-400">
                  Level up to unlock more slots
                </div>
              )}
              <button
                onClick={() => setShowPreview(false)}
                className="w-full text-gray-400 font-medium py-2 text-sm active:text-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
