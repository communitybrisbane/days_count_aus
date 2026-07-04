"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, getDoc, doc, query, orderBy, where, limit, updateDoc, arrayUnion, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { UserPrivate } from "@/types";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { MAIN_MODE_OPTIONS, GROUP_JOIN_LEVEL, GROUP_CREATE_LEVEL, getMaxCommunitySlots, NAV_HEIGHT } from "@/lib/constants";
import { calculateLevel } from "@/lib/utils";
import { useUnreadGroups } from "@/hooks/useUnreadGroups";
import BottomNav from "@/components/layout/BottomNav";
import LoadingSpinner from "@/components/LoadingSpinner";
import { GroupListSkeleton } from "@/components/Skeleton";
import GroupCard from "@/components/GroupCard";
import { IconSearch, IconUsers, IconLock, FocusModeIcon } from "@/components/icons";
import BannerCarousel from "@/components/BannerCarousel";
import MeetingBoard from "@/components/MeetingBoard";
import type { Group } from "@/types";

export default function GroupsPage() {
  useAuthGuard({ requireProfile: false });
  const { user, profile, privateData, loading, refreshProfile } = useAuth();
  const { unreadMap, liveDataMap, clearedGroupIds, mutedGroupIds } = useUnreadGroups(user?.uid, profile?.groupIds || []);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [modeFilter, setModeFilter] = useState("");
  const [showActionChoice, setShowActionChoice] = useState(false);

  const [leaderNames, setLeaderNames] = useState<Record<string, string>>({});
  const [kickedNotices, setKickedNotices] = useState<{ groupId: string; groupName: string; at: string }[]>([]);

  useEffect(() => {
    if (privateData?.kickedFrom?.length) {
      setKickedNotices(privateData.kickedFrom);
    }
  }, [privateData?.kickedFrom]);

  const dismissKickNotice = async (groupId: string) => {
    if (!user) return;
    const updated = kickedNotices.filter((k) => k.groupId !== groupId);
    setKickedNotices(updated);
    const privRef = doc(db, "users", user.uid, "private", "config");
    await setDoc(privRef, { kickedFrom: updated }, { merge: true });
  };


  const fetchGroups = async () => {
    const q = query(collection(db, "groups"), where("isClosed", "==", false), orderBy("lastMessageAt", "desc"), limit(50));
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
    setGroups(data);
    setLoadingGroups(false);
  };

  useEffect(() => {
    if (user) {
      // Mode groups are fully optional (join/leave freely) — no auto-rejoin here
      fetchGroups();
    }
  }, [user]);

  const handleJoined = async () => {
    await refreshProfile();
    await fetchGroups();
    setShowSearch(false);
  };

  // Fetch leader names（公式・ユーザーコミュニティ共通で Creator の名前を揃える）
  useEffect(() => {
    if (groups.length === 0) return;
    const leaderIds = [...new Set(groups.filter((g) => g.creatorId).map((g) => g.creatorId))];
    if (leaderIds.length === 0) return;
    Promise.all(
      leaderIds.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, "users", uid));
          return { uid, name: snap.exists() ? (snap.data().displayName as string) : "Unknown" };
        } catch {
          return { uid, name: "Unknown" };
        }
      })
    ).then((results) => {
      const names: Record<string, string> = {};
      results.forEach((r) => { names[r.uid] = r.name; });
      setLeaderNames(names);
    });
  }, [groups]);

  const level = profile ? calculateLevel(profile.totalXP) : 1;
  const canJoinCommunity = level >= GROUP_JOIN_LEVEL;
  const userGroups = groups.filter((g) => !g.isOfficial);
  const isModeGroup = (g: Group) => g.isOfficial && !g.iconUrl;
  // Mode groups are fully optional — show only the ones the user is actually in
  const joinedModeGroups = groups.filter((g) =>
    isModeGroup(g) && g.memberIds?.includes(user?.uid || "")
  );
  const myJoinedGroups = [
    ...joinedModeGroups,
    ...groups.filter((g) => !isModeGroup(g) && g.memberIds?.includes(user?.uid || "")),
  ].sort((a, b) => {
    const aCleared = clearedGroupIds.has(a.id);
    const bCleared = clearedGroupIds.has(b.id);
    if (aCleared !== bCleared) return aCleared ? 1 : -1;
    const aTime = liveDataMap.get(a.id)?.lastMessageAt?.toMillis() ?? a.lastMessageAt?.toMillis?.() ?? 0;
    const bTime = liveDataMap.get(b.id)?.lastMessageAt?.toMillis() ?? b.lastMessageAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  });
  const myJoinedExtra = myJoinedGroups.filter((g) => !isModeGroup(g));
  const hasCreatedGroup = groups.some((g) => !g.isOfficial && g.creatorId === user?.uid);
  const maxSlots = getMaxCommunitySlots(level);
  const hasMaxGroups = myJoinedExtra.length >= maxSlots;
  const canJoinMore = myJoinedExtra.length < maxSlots;
  const canCreateCommunity = level >= GROUP_CREATE_LEVEL;

  // Search shows user-created communities + mode groups not yet joined
  const searchableGroups = groups.filter((g) => !g.isClosed && !myJoinedGroups.some((j) => j.id === g.id));
  let filteredUserGroups = searchableGroups;
  if (modeFilter) {
    filteredUserGroups = filteredUserGroups.filter((g) => g.mode === modeFilter);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filteredUserGroups = filteredUserGroups.filter((g) =>
      g.groupName.toLowerCase().includes(q)
    );
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ paddingBottom: NAV_HEIGHT }}>
      {/* Header */}
      <div className="sticky top-0 bg-forest/95 backdrop-blur-md z-10 border-b border-forest-light/20" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
        <div className="px-4 pt-3 pb-2">
          <h1 className="text-lg font-bold text-white/90">Community</h1>
        </div>
      </div>

      {/* Search panel — community only */}
      {showSearch && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pb-3 pt-2 space-y-2 shrink-0 bg-forest/90 border-b border-forest-light/20">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.replace(/[^\x20-\x7E]/g, ""))}
                placeholder="Search by community name..."
                className="flex-1 border border-forest-light/30 bg-forest-light/20 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange placeholder-white/30"
                autoFocus
              />
              <button
                onClick={() => { setShowSearch(false); setSearchQuery(""); setModeFilter(""); }}
                className="text-white/40 text-sm shrink-0"
              >
                Cancel
              </button>
            </div>
            {/* Mode filter — 2-row grid like explore */}
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <button
                  onClick={() => setModeFilter("")}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    !modeFilter ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
                  }`}
                >
                  All
                </button>
                {MAIN_MODE_OPTIONS.filter((m) => ["english", "skill", "challenge"].includes(m.id)).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModeFilter(m.id)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-sm font-medium transition-all ${
                      modeFilter === m.id ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
                    }`}
                  >
                    <FocusModeIcon modeId={m.id} size={14} /> {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">
            {loadingGroups && <LoadingSpinner size="sm" />}
            {!loadingGroups && filteredUserGroups.length === 0 && (
              <p className="text-center text-white/40 py-4 text-sm">No matching communities found</p>
            )}
            {filteredUserGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                currentUserId={user?.uid}
                leaderName={leaderNames[group.creatorId]}
                canJoin={isModeGroup(group) ? true : canJoinCommunity && canJoinMore}
                onJoined={handleJoined}
                showGoal
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== Main content (non-search) ===== */}
      {!showSearch && (
        <div className="flex-1 overflow-y-auto">
          {loadingGroups ? (
            <GroupListSkeleton />
          ) : (
            <>
              {/* Live Meetings */}
              <MeetingBoard currentUid={user?.uid} region={profile?.region} />

              {/* Kicked notices */}
              {kickedNotices.map((k) => (
                <div key={k.groupId} className="mx-4 mt-2 bg-red-500/10 border border-red-400/20 rounded-xl px-4 py-3 flex items-center justify-between">
                  <p className="text-xs text-red-400">You were removed from <span className="font-bold">{k.groupName}</span></p>
                  <button onClick={() => dismissKickNotice(k.groupId)} className="text-white/40 text-sm ml-2 shrink-0">&times;</button>
                </div>
              ))}

              {/* Group Chat section */}
              <div className="px-4 pt-2">
                <p className="text-xs font-bold text-white/50 mb-2 px-1">Group Chat <span className="font-normal text-white/30">{myJoinedGroups.length}/{maxSlots + joinedModeGroups.length}</span></p>
              </div>
              <div className="flex flex-col">
                {myJoinedGroups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    currentUserId={user?.uid}
                    leaderName={leaderNames[group.creatorId]}
                    unreadCount={unreadMap.get(group.id) || 0}
                    liveMessageText={liveDataMap.get(group.id)?.lastMessageText}
                    cleared={clearedGroupIds.has(group.id)}
                    muted={mutedGroupIds.has(group.id)}
                    onClearHistory={(gid) => {
                      setGroups((prev) => prev.map((g) => g.id === gid ? { ...g, lastMessageText: "" } : g));
                    }}
                  />
                ))}

                {/* Add Community — always visible so mode groups stay joinable */}
                <button
                  onClick={() => setShowActionChoice(true)}
                  className="w-full py-3 text-center text-sm font-bold text-accent-orange active:opacity-70 transition-opacity"
                >
                  + Find or Create
                </button>
                {!canJoinCommunity && (
                  <p className="text-center text-[10px] text-white/30 py-3">
                    <IconLock size={10} className="inline mr-1" />
                    Communities unlock at Lv.{GROUP_JOIN_LEVEL}
                  </p>
                )}
              </div>

              {/* Banner */}
              <div className="px-4 pt-4">
                <BannerCarousel location="community" />
              </div>
              <div className="h-4" />
            </>
          )}
        </div>
      )}

      {/* Action choice modal */}
      {showActionChoice && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowActionChoice(false)} />
          <div className="fixed inset-x-0 z-50 bg-white rounded-t-2xl" style={{ bottom: NAV_HEIGHT }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-sm">What would you like to do?</h3>
              <button onClick={() => setShowActionChoice(false)} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center" aria-label="Close">&times;</button>
            </div>

            <div className="p-4 space-y-3">
              {/* Join */}
              <button
                onClick={() => { setShowActionChoice(false); setShowSearch(true); }}
                className="w-full flex items-center gap-3 p-4 rounded-xl text-left bg-gray-50 active:bg-gray-100"
              >
                <div className="w-10 h-10 rounded-full bg-forest-mid/10 flex items-center justify-center shrink-0">
                  <IconSearch size={18} className="text-forest-mid" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Join a Community</p>
                  <p className="text-[10px] text-gray-400">
                    {canJoinMore ? "Search and join an existing community" : "Community slots are full — official groups are always open"}
                  </p>
                </div>
              </button>

              {/* Create */}
              {canCreateCommunity && !hasCreatedGroup && !hasMaxGroups ? (
                <Link
                  href="/groups/create"
                  onClick={() => setShowActionChoice(false)}
                  className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-xl text-left active:bg-gray-100"
                >
                  <div className="w-10 h-10 rounded-full bg-accent-orange/10 flex items-center justify-center shrink-0">
                    <span className="text-accent-orange font-bold text-lg">+</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Create a Community</p>
                    <p className="text-[10px] text-gray-400">Start your own group as a leader</p>
                  </div>
                </Link>
              ) : (
                <div className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-xl opacity-40">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <IconLock size={18} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-400">Create a Community</p>
                    <p className="text-[10px] text-gray-400">
                      {hasMaxGroups ? "Level up to unlock more slots" : hasCreatedGroup ? "You already lead a group (max 1)" : `Unlocks at Lv.${GROUP_CREATE_LEVEL}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}
