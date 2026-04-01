"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { calculateLevel } from "@/lib/utils";
import { fetchUserPosts } from "@/lib/services/posts";
import { fetchUserGroups } from "@/lib/groups";
import { FOCUS_MODES, resolveMode, NAV_HEIGHT } from "@/lib/constants";
import Avatar from "@/components/Avatar";
import PostDetailModal from "@/components/PostDetailModal";
import PostGrid from "@/components/PostGrid";
import ProfileGroups from "@/components/ProfileGroups";
import ModeFilterBar from "@/components/ModeFilterBar";
import FollowingModal from "@/components/FollowingModal";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNav from "@/components/layout/BottomNav";
import { IconSettings, FocusModeIcon } from "@/components/icons";
import type { Post, Group } from "@/types";
import { NO_SCROLLBAR_STYLE } from "@/types";

export default function MyPage() {
  const { user, profile, loading } = useAuthGuard();
  const { following } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [modeFilter, setModeFilter] = useState("");
  const [showFollowing, setShowFollowing] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchUserPosts(user.uid, true).then((data) => {
      setPosts(data);
      setLoadingPosts(false);
    });
  }, [user]);

  useEffect(() => {
    if (!profile?.groupIds?.length) { setUserGroups([]); return; }
    fetchUserGroups(profile.groupIds!).then(setUserGroups);
  }, [profile?.groupIds]);

  if (loading || !profile) {
    return <LoadingSpinner fullScreen />;
  }

  const level = calculateLevel(profile.totalXP);
  const filteredPosts = modeFilter ? posts.filter((p) => resolveMode(p.mode) === modeFilter) : posts;

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ paddingBottom: NAV_HEIGHT }}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={NO_SCROLLBAR_STYLE}>
      {/* プロフィール — Instagram風中央レイアウト with geometric bg */}
      <div className="relative px-5 pb-3" style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }}>
        {/* Geometric background for profile header */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-forest-light/15 rotate-45" />
          <div className="absolute bottom-0 -left-6 w-36 h-36 bg-forest-mid/10 -rotate-12" />
        </div>

        {/* 設定アイコン — 右上 */}
        <button onClick={() => router.push("/settings")} className="absolute top-0 right-3 text-white/40 w-10 h-10 flex items-center justify-center z-10" style={{ marginTop: "max(1rem, env(safe-area-inset-top, 0px))" }}>
          <IconSettings size={24} />
        </button>

        <div className="flex flex-col items-center pt-8 relative">
          {/* アバター */}
          <div className="ring-3 ring-accent-orange/40 rounded-full">
            <Avatar
              photoURL={profile.photoURL}
              displayName={profile.displayName}
              uid={user!.uid}
              size={96}
            />
          </div>

          {/* 名前 */}
          <h2 className="text-xl font-bold mt-2 truncate max-w-[80%] text-center text-white/90">{profile.displayName}</h2>

          {/* モード・地域 — 横並び */}
          <div className="flex items-center justify-center gap-1.5 mt-2">
            {profile.mainMode && (
              <span className="inline-flex items-center gap-1 text-xs text-white/60 bg-forest-light/30 px-2.5 py-0.5 rounded-full">
                <FocusModeIcon modeId={resolveMode(profile.mainMode)} size={12} />
                {FOCUS_MODES.find((m) => m.id === resolveMode(profile.mainMode))?.label}
              </span>
            )}
            {profile.region && profile.showRegion !== false && (
              <span className="text-xs text-white/60 bg-forest-light/30 px-2.5 py-0.5 rounded-full">
                {profile.region}
              </span>
            )}
          </div>
          {/* ゴール */}
          {profile.goal && (
            <p className="text-lg font-bold text-white/80 mt-2 text-center max-w-[85%] leading-snug">{profile.goal}</p>
          )}

          {/* Likes / Streak / Following */}
          <div className="flex gap-8 mt-3 text-center">
            <div>
              <p className="font-bold text-base text-white/90">{posts.reduce((sum, p) => sum + (p.likeCount || 0), 0)}</p>
              <p className="text-[11px] text-white/40">Likes</p>
            </div>
            <div>
              <p className="font-bold text-base text-white/90">{profile.currentStreak ?? 0}</p>
              <p className="text-[11px] text-white/40">Streak</p>
            </div>
            <button onClick={() => setShowFollowing(true)}>
              <p className="font-bold text-base text-white/90">{following.length}</p>
              <p className="text-[11px] text-white/40">Following</p>
            </button>
          </div>

          <ProfileGroups groups={userGroups} />
        </div>
      </div>

      <ModeFilterBar value={modeFilter} onChange={setModeFilter} />

      {/* 投稿グリッド */}
      <div className="flex-1 min-h-0">
        {loadingPosts ? (
          <LoadingSpinner size="sm" />
        ) : filteredPosts.length === 0 ? (
          <p className="text-center text-white/40 py-8">{modeFilter ? "No posts in this mode" : "No posts yet"}</p>
        ) : (
          <PostGrid posts={filteredPosts} onSelect={setSelectedIndex} />
        )}
      </div>
      </div>

      {selectedIndex !== null && (
        <PostDetailModal
          posts={filteredPosts}
          selectedIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onDelete={(postId) => {
            setPosts((prev) => prev.filter((p) => p.id !== postId));
            setSelectedIndex(null);
          }}
        />
      )}

      {showFollowing && (
        <FollowingModal
          followingIds={following}
          onClose={() => setShowFollowing(false)}
          onSelect={(uid) => router.push(`/user/${uid}`)}
        />
      )}

      <BottomNav onMyClick={selectedIndex !== null ? () => setSelectedIndex(null) : undefined} />
    </div>
  );
}
