"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, query, orderBy, where, limit as firestoreLimit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { FOCUS_MODES } from "@/lib/constants";
import { calculateLevel } from "@/lib/utils";
import { followUser, unfollowUser } from "@/lib/follow";
import BottomNav from "@/components/layout/BottomNav";
import LoadingSpinner from "@/components/LoadingSpinner";
import GroupCard from "@/components/GroupCard";
import Avatar from "@/components/Avatar";
import { IconSearch, IconUsers, IconPin, FocusModeIcon } from "@/components/icons";
import BannerCarousel from "@/components/BannerCarousel";
import type { Group } from "@/types";

interface UserResult {
  uid: string;
  displayName: string;
  photoURL: string;
  mainMode: string;
  region: string;
  totalXP: number;
}

export default function GroupsPage() {
  useAuthGuard({ requireProfile: false });
  const { user, profile, loading, following, refreshFollowing } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [modeFilter, setModeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchTab, setSearchTab] = useState<"groups" | "users">("groups");

  // User search
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function fetchGroups() {
      const q = query(collection(db, "groups"), orderBy("lastMessageAt", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Group))
        .filter((g) => !g.isClosed);
      setGroups(data);
      setLoadingGroups(false);
    }
    if (user) fetchGroups();
  }, [user]);

  // User search with debounce
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!userQuery.trim()) {
      setUserResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const q = query(collection(db, "users"), orderBy("displayName"));
        const snap = await getDocs(q);
        const keyword = userQuery.trim().toLowerCase();
        const results = snap.docs
          .map((d) => d.data() as UserResult)
          .filter((u) => u.uid !== user?.uid && u.displayName.toLowerCase().includes(keyword));
        setUserResults(results.slice(0, 20));
      } catch (e) {
        console.error(e);
      } finally {
        setSearchingUsers(false);
      }
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [userQuery, user]);

  const canCreate = profile ? calculateLevel(profile.totalXP) >= 5 : false;
  const groupCount = profile?.groupIds?.length || 0;
  const hasMaxGroups = groupCount >= 2;

  const officialGroups = groups.filter((g) => g.isOfficial && g.mode === profile?.mainMode);
  const userGroups = groups.filter((g) => !g.isOfficial);
  const myJoinedGroups = groups.filter((g) => g.memberIds?.includes(user?.uid || ""));

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
    <div className="min-h-dvh pb-20">
      <div className="sticky top-0 bg-white z-10 border-b border-gray-100">
        <div className="flex items-center justify-between p-4 pb-2">
          <h1 className="text-lg font-bold">Community</h1>
          <button
            onClick={() => setShowSearch((v) => !v)}
            className="text-gray-500 text-sm px-3 py-1.5 rounded-full border border-gray-200"
          >
            {showSearch ? "× Close" : <span className="flex items-center gap-1"><IconSearch size={14} /> Search</span>}
          </button>
        </div>

        {/* Search panel */}
        {showSearch && (
          <div className="px-4 pb-3 space-y-2">
            {/* Tab toggle */}
            <div className="flex bg-gray-100 rounded-full p-0.5">
              <button
                onClick={() => setSearchTab("groups")}
                className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-all ${
                  searchTab === "groups" ? "bg-white text-gray-800 shadow-sm" : "text-gray-400"
                }`}
              >
                Community
              </button>
              <button
                onClick={() => setSearchTab("users")}
                className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-all ${
                  searchTab === "users" ? "bg-white text-gray-800 shadow-sm" : "text-gray-400"
                }`}
              >
                <span className="flex items-center justify-center gap-1"><IconUsers size={12} /> Find Users</span>
              </button>
            </div>

            {searchTab === "groups" ? (
              <>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by community name..."
                  className="w-full border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-aussie-gold"
                />
                {canCreate && (
                  <Link
                    href="/groups/create"
                    className="block text-center bg-aussie-gold text-white text-sm font-bold px-4 py-2 rounded-full"
                  >
                    + Create Community
                  </Link>
                )}
                {hasMaxGroups && (
                  <p className="text-xs text-gray-400 text-center">You're in {groupCount}/2 groups (+ official)</p>
                )}
                {!canCreate && (
                  <p className="text-xs text-gray-400 text-center">Reach Lv.5 to create a community</p>
                )}
              </>
            ) : (
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search by nickname..."
                className="w-full border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-aussie-gold"
                autoFocus
              />
            )}
          </div>
        )}

        {/* Mode filter — only show when searching groups */}
        {showSearch && searchTab === "groups" && (
          <div className="flex gap-1 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            <button
              onClick={() => setModeFilter("")}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                !modeFilter ? "bg-aussie-gold text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              All
            </button>
            {FOCUS_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setModeFilter(m.id)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                  modeFilter === m.id
                    ? "bg-aussie-gold text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                <FocusModeIcon modeId={m.id} size={12} className="inline-block align-middle" /> {m.description}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Default: show joined groups only */}
      {!showSearch && (
        <div className="p-4 space-y-3">
          {loadingGroups ? (
            <LoadingSpinner size="sm" />
          ) : myJoinedGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <IconSearch size={40} className="text-gray-200 mb-4" />
              <p className="text-sm text-gray-500 font-medium mb-1">Find your community</p>
              <p className="text-xs text-gray-400">Tap Search to find communities and users</p>
              {!canCreate && (
                <p className="text-xs text-gray-400 mt-2">Reach <span className="text-ocean-blue font-bold">Lv.5</span> to create your own</p>
              )}
            </div>
          ) : (
            <>
              {myJoinedGroups.map((group) => (
                <GroupCard key={group.id} group={group} currentUserId={user?.uid} />
              ))}
              <p className="text-xs text-gray-400 text-center pt-1">Tap Search to find more communities</p>
            </>
          )}
        </div>
      )}

      {/* User search results */}
      {showSearch && searchTab === "users" && (
        <div className="p-4 space-y-2">
          {searchingUsers && <LoadingSpinner size="sm" />}
          {!searchingUsers && userQuery.trim() && userResults.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">No users found</p>
          )}
          {!userQuery.trim() && !searchingUsers && (
            <p className="text-center text-gray-400 py-8 text-sm">Type a nickname to search</p>
          )}
          {userResults.map((u) => {
            const isFollowing = following.includes(u.uid);
            const level = calculateLevel(u.totalXP);
            const modeInfo = FOCUS_MODES.find((m) => m.id === u.mainMode);
            return (
              <div
                key={u.uid}
                className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
              >
                <Link href={`/user/${u.uid}`} className="shrink-0">
                  <Avatar photoURL={u.photoURL} displayName={u.displayName} uid={u.uid} size={48} />
                </Link>
                <Link href={`/user/${u.uid}`} className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{u.displayName}</p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                    <span className="text-ocean-blue font-medium">Lv.{level}</span>
                    {modeInfo && (
                      <span className="flex items-center gap-0.5">
                        · <FocusModeIcon modeId={modeInfo.id} size={10} className="text-gray-400" />
                        {modeInfo.description}
                      </span>
                    )}
                    {u.region && (
                      <span className="flex items-center gap-0.5">
                        · <IconPin size={10} /> {u.region}
                      </span>
                    )}
                  </div>
                </Link>
                {user && (
                  <button
                    onClick={async () => {
                      if (isFollowing) {
                        await unfollowUser(user.uid, u.uid);
                      } else {
                        await followUser(user.uid, u.uid);
                      }
                      await refreshFollowing();
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border shrink-0 font-medium ${
                      isFollowing
                        ? "border-gray-200 text-gray-400"
                        : "border-ocean-blue text-ocean-blue"
                    }`}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Group search results — only when search is open and groups tab selected */}
      {showSearch && searchTab === "groups" && (
        <div className="p-4 space-y-3">
          {loadingGroups && <LoadingSpinner size="sm" />}

          {/* Official groups */}
          {!loadingGroups && (!modeFilter || modeFilter === profile?.mainMode) && officialGroups.map((group) => (
            <GroupCard key={group.id} group={group} currentUserId={user?.uid} />
          ))}

          {/* User groups */}
          {!loadingGroups && filteredUserGroups.length === 0 && (
            <p className="text-center text-gray-400 py-4 text-sm">No matching communities found</p>
          )}

          {filteredUserGroups.map((group) => (
            <GroupCard key={group.id} group={group} currentUserId={user?.uid} />
          ))}
        </div>
      )}

      {/* Banner */}
      <div className="px-4">
        <BannerCarousel location="community" />
      </div>

      <BottomNav />
    </div>
  );
}
