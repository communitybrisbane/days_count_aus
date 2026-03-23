"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, getDoc, doc, query, orderBy, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { FOCUS_MODES, GROUP_JOIN_LEVEL, GROUP_CREATE_LEVEL } from "@/lib/constants";
import { calculateLevel } from "@/lib/utils";
import { fetchAdminConfig } from "@/lib/services/users";
import BottomNav from "@/components/layout/BottomNav";
import LoadingSpinner from "@/components/LoadingSpinner";
import GroupCard from "@/components/GroupCard";
import { IconSearch, IconUsers, IconLock, FocusModeIcon } from "@/components/icons";
import BannerCarousel from "@/components/BannerCarousel";
import type { Group, LiveSession } from "@/types";

export default function GroupsPage() {
  useAuthGuard({ requireProfile: false });
  const { user, profile, loading, refreshProfile } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [modeFilter, setModeFilter] = useState("");

  const [leaderNames, setLeaderNames] = useState<Record<string, string>>({});
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);


  const fetchGroups = async () => {
    const q = query(collection(db, "groups"), where("isClosed", "==", false), orderBy("lastMessageAt", "desc"), limit(50));
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
    setGroups(data);
    setLoadingGroups(false);
  };

  useEffect(() => {
    if (user) {
      fetchGroups();
      fetchAdminConfig().then((data) => {
        if (data?.liveSession) setLiveSession(data.liveSession as LiveSession);
      }).catch(console.error);
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
  const canCreateCommunity = level >= GROUP_CREATE_LEVEL;
  const groupCount = profile?.groupIds?.length || 0;
  const hasMaxGroups = groupCount >= 2;

  const userGroups = groups.filter((g) => !g.isOfficial);
  const myJoinedGroups = groups.filter((g) =>
    g.isOfficial
      ? g.mode === profile?.mainMode
      : g.memberIds?.includes(user?.uid || "")
  );
  const myJoinedNonOfficial = myJoinedGroups.filter((g) => !g.isOfficial);
  const myJoinedOnly = myJoinedNonOfficial.filter((g) => g.creatorId !== user?.uid);
  const hasCreatedGroup = groups.some((g) => !g.isOfficial && g.creatorId === user?.uid);

  let filteredUserGroups = userGroups;
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
    <div className="h-dvh flex flex-col overflow-hidden pb-16">
      {/* Header */}
      <div className="sticky top-0 bg-forest/95 backdrop-blur-md z-10 border-b border-forest-light/20" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="px-4 pt-3 pb-2">
          <h1 className="text-lg font-bold text-white/90">Community</h1>
        </div>
      </div>

      {/* Search panel — community only */}
      {showSearch && (
        <div className="bg-forest/90 border-b border-forest-light/20">
          <div className="px-4 pb-3 pt-2 space-y-2">
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
            {/* Mode filter */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              <button
                onClick={() => setModeFilter("")}
                className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap ${
                  !modeFilter ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
                }`}
              >
                All
              </button>
              {FOCUS_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModeFilter(m.id)}
                  className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap ${
                    modeFilter === m.id
                      ? "bg-accent-orange text-white"
                      : "bg-white text-forest-mid"
                  }`}
                >
                  <FocusModeIcon modeId={m.id} size={14} className="inline-block align-middle" /> {m.description}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-3">
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
                canJoin={canJoinCommunity && !hasMaxGroups}
                onJoined={handleJoined}
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== Main content (non-search) ===== */}
      {!showSearch && (
        <div className="flex-1 overflow-y-auto">
          {loadingGroups ? (
            <div className="p-4"><LoadingSpinner size="sm" /></div>
          ) : (
            <>
              {/* Live Session */}
              {liveSession && (
                <div className="px-4 pt-2">
                  <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${
                    liveSession.url
                      ? "border-forest-mid/30 ring-2 ring-ocean-blue/20 shadow-ocean-blue/10"
                      : "border-gray-100"
                  }`}>
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${liveSession.url ? "bg-green-400 animate-pulse" : "bg-gray-300"}`} />
                          <p className={`font-bold text-sm truncate ${liveSession.url ? "text-forest-mid" : "text-gray-600"}`}>
                            {liveSession.label || "Live Session"}
                          </p>
                          {liveSession.url && (
                            <span className="text-[10px] font-bold text-white bg-forest-mid px-2 py-0.5 rounded-full animate-pulse shrink-0">
                              LIVE
                            </span>
                          )}
                        </div>
                        <p className={`text-xs mt-0.5 ml-[18px] ${liveSession.url ? "text-gray-600" : "text-gray-400"}`}>
                          {liveSession.url ? "Session in progress — join now!" : liveSession.description || "Next session TBD"}
                        </p>
                      </div>
                      {liveSession.url ? (
                        <a
                          href={liveSession.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-forest-mid text-white text-sm font-bold px-4 py-2 rounded-xl shadow-md shrink-0 ml-3 active:scale-[0.97]"
                        >
                          Join
                        </a>
                      ) : (
                        <span className="text-sm font-bold text-gray-300 px-4 py-2 rounded-xl border border-gray-200 shrink-0 ml-3">
                          Join
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* All joined groups — sorted by lastMessageAt */}
              <div className="flex flex-col px-4 py-1 gap-1.5">
                {myJoinedGroups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    currentUserId={user?.uid}
                    leaderName={leaderNames[group.creatorId]}
                  />
                ))}

                {/* Join suggest — only when not joined any non-official group (excludes own created) */}
                {myJoinedOnly.length === 0 && (
                  !canJoinCommunity ? (
                    <div className="card-material border-0 p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-forest-mid/10 flex items-center justify-center shrink-0">
                          <IconLock size={18} className="text-forest-mid" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-700">Join Communities</p>
                          <p className="text-[10px] text-gray-400">Unlocks at Lv.{GROUP_JOIN_LEVEL}</p>
                        </div>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-forest-mid h-2 rounded-full transition-all"
                          style={{ width: `${Math.min((level / GROUP_JOIN_LEVEL) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 text-right mt-1">Lv.{level} / Lv.{GROUP_JOIN_LEVEL}</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-forest-mid/20 p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-forest-mid/10 flex items-center justify-center shrink-0">
                          <IconUsers size={18} className="text-forest-mid" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-forest-mid">Join Communities</p>
                          <p className="text-[10px] text-gray-400">Search to find and join communities</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowSearch(true)}
                        className="w-full py-2 text-xs font-bold text-white bg-forest-mid rounded-full"
                      >
                        Search Communities
                      </button>
                    </div>
                  )
                )}

                {/* Create suggest — only when no created groups */}
                {!hasCreatedGroup && (
                  !canCreateCommunity ? (
                    <div className="card-material border-0 p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-accent-orange/10 flex items-center justify-center shrink-0">
                          <IconLock size={18} className="text-accent-orange" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-700">Create Community</p>
                          <p className="text-[10px] text-gray-400">Unlocks at Lv.{GROUP_CREATE_LEVEL}</p>
                        </div>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-accent-orange h-2 rounded-full transition-all"
                          style={{ width: `${Math.min((level / GROUP_CREATE_LEVEL) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 text-right mt-1">Lv.{level} / Lv.{GROUP_CREATE_LEVEL}</p>
                    </div>
                  ) : (
                    <Link href="/groups/create" className="block bg-white rounded-2xl border border-accent-orange/20 p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-accent-orange/10 flex items-center justify-center shrink-0">
                          <span className="text-accent-orange font-bold text-lg">+</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-accent-orange">Create Community</p>
                          <p className="text-[10px] text-gray-400">Start your own community as a leader</p>
                        </div>
                      </div>
                      <div className="w-full py-2 text-xs font-bold text-white bg-accent-orange rounded-full text-center">
                        Create Now
                      </div>
                    </Link>
                  )
                )}
              </div>

              {/* Banner — fixed above footer */}
              <div className="px-4 pb-1 mt-auto">
                <BannerCarousel location="community" />
              </div>
            </>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
