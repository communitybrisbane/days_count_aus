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
import dynamic from "next/dynamic";
const PostDetailModal = dynamic(() => import("@/components/PostDetailModal"), { ssr: false });
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
    <div className="h-dvh flex flex-col overflow-hidden relative" style={{ paddingBottom: NAV_HEIGHT }}>
      {/* Geometric background — full page */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-forest-light/15 rotate-45" />
        <div className="absolute top-[40%] -left-6 w-36 h-36 bg-forest-mid/10 -rotate-12" />
        <div className="absolute bottom-[20%] -right-8 w-40 h-40 bg-forest-light/10 rotate-[30deg]" />
        <div className="absolute bottom-[50%] left-[30%] w-24 h-24 bg-forest-mid/8 rotate-[60deg]" />
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-[1]" style={NO_SCROLLBAR_STYLE}>
      {/* プロフィール — Instagram風中央レイアウト */}
      <div className="relative px-5 pb-3" style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }}>

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

          {/* レベル + 名前 */}
          <h2 className="text-xl font-bold mt-2 truncate max-w-[80%] text-center text-white/90">
            <span className="text-accent-orange">Lv.{level}</span> {profile.displayName}
          </h2>

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
