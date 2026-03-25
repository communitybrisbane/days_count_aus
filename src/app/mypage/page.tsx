"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { calculateLevel } from "@/lib/utils";
import { fetchUserPosts } from "@/lib/services/posts";
import { FOCUS_MODES, MAIN_MODE_OPTIONS, GRADIENTS, resolveMode } from "@/lib/constants";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/PostCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNav from "@/components/layout/BottomNav";
import { IconSettings, IconKangaroo, IconLock, FocusModeIcon } from "@/components/icons";
import type { Post, Group } from "@/types";
import { NO_SCROLLBAR_STYLE } from "@/types";
import { useSwipeDismiss } from "@/hooks/useSwipeDismiss";

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
  const [followingProfiles, setFollowingProfiles] = useState<{ uid: string; displayName: string; photoURL: string; mainMode?: string; region?: string; showRegion?: boolean }[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const swipePost = useSwipeDismiss(() => setSelectedIndex(null));
  const swipeFollowing = useSwipeDismiss(() => setShowFollowing(false));

  useEffect(() => {
    if (!user) return;
    fetchUserPosts(user.uid, true).then((data) => {
      setPosts(data);
      setLoadingPosts(false);
    });
  }, [user]);

  useEffect(() => {
    if (!profile?.groupIds?.length) { setUserGroups([]); return; }
    (async () => {
      const groups: Group[] = [];
      for (const gid of profile.groupIds!) {
        const snap = await getDoc(doc(db, "groups", gid));
        if (snap.exists()) {
          const g = { id: snap.id, ...snap.data() } as Group;
          if (!g.isClosed && (!g.isOfficial || g.iconUrl)) groups.push(g);
        }
      }
      setUserGroups(groups);
    })();
  }, [profile?.groupIds]);

  const handleOpenFollowing = async () => {
    setShowFollowing(true);
    if (followingProfiles.length > 0 || following.length === 0) return;
    setLoadingFollowing(true);
    const profiles: typeof followingProfiles = [];
    const displayIds = following.slice(0, 50);
    for (const uid of displayIds) {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        const d = snap.data();
        profiles.push({ uid, displayName: d.displayName || "", photoURL: d.photoURL || "", mainMode: d.mainMode, region: d.region, showRegion: d.showRegion });
      }
    }
    setFollowingProfiles(profiles);
    setLoadingFollowing(false);
  };

  if (loading || !profile) {
    return <LoadingSpinner fullScreen />;
  }

  const level = calculateLevel(profile.totalXP);

  const filteredPosts = modeFilter ? posts.filter((p) => resolveMode(p.mode) === modeFilter) : posts;

  const getPostThumb = (post: Post) => {
    if (post.imageUrl) return { type: "image" as const, url: post.imageUrl };
    const resolved = resolveMode(post.mode || "");
    const gradientIdx = resolved ? FOCUS_MODES.findIndex((m) => m.id === resolved) : 0;
    return { type: "gradient" as const, gradient: GRADIENTS[gradientIdx >= 0 ? gradientIdx : 0] };
  };

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ paddingBottom: "3rem" }}>
      <div className="flex-1 overflow-y-auto" style={NO_SCROLLBAR_STYLE}>
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
            <button onClick={handleOpenFollowing}>
              <p className="font-bold text-base text-white/90">{following.length}</p>
              <p className="text-[11px] text-white/40">Following</p>
            </button>
          </div>

          {/* Groups */}
          {userGroups.length > 0 && (
            <div className="flex gap-3 mt-3 w-full justify-center">
              {userGroups.map((g) => {
                const modeInfo = FOCUS_MODES.find((m) => m.id === resolveMode(g.mode || ""));
                return (
                  <button
                    key={g.id}
                    onClick={() => router.push(`/groups/${g.id}`)}
                    className="flex flex-col items-center gap-1.5 rounded-xl px-4 py-3 min-w-[130px] max-w-[160px] active:bg-forest-light/20 transition-colors"
                  >
                    {g.iconUrl ? (
                      <img src={g.iconUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : modeInfo ? (
                      <div className="w-10 h-10 rounded-full bg-forest-mid/40 flex items-center justify-center">
                        <FocusModeIcon modeId={modeInfo.id} size={20} className="text-white" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-forest-mid/40" />
                    )}
                    <p className="text-xs font-bold text-white/80 truncate w-full text-center">{g.groupName}</p>
                    <p className="text-[10px] text-white/40">{g.memberCount}/10</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* モードアイコン — 投稿のすぐ上 */}
      <div className="flex justify-around px-4 py-2.5 bg-forest/50">
        <button
          onClick={() => setModeFilter("")}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
            !modeFilter ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
          }`}
        >
          All
        </button>
        {MAIN_MODE_OPTIONS.map((m) => (
          <button
            key={m.id}
            onClick={() => setModeFilter(m.id)}
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              modeFilter === m.id
                ? "bg-accent-orange"
                : "bg-white"
            }`}
          >
            <FocusModeIcon modeId={m.id} size={28} className={modeFilter === m.id ? "text-white" : "text-forest-mid"} />
          </button>
        ))}
      </div>

      {/* 投稿グリッド */}
      <div className="flex-1 min-h-0">
        {loadingPosts ? (
          <LoadingSpinner size="sm" />
        ) : filteredPosts.length === 0 ? (
          <p className="text-center text-white/40 py-8">{modeFilter ? "No posts in this mode" : "No posts yet"}</p>
        ) : (
          <div className="grid grid-cols-4">
            {filteredPosts.map((post, idx) => {
              const thumb = getPostThumb(post);
              const modeInfo = FOCUS_MODES.find((m) => m.id === resolveMode(post.mode || ""));
              return (
                <button
                  key={post.id}
                  onClick={() => setSelectedIndex(idx)}
                  className="relative aspect-square overflow-hidden"
                >
                  {thumb.type === "image" ? (
                    <img
                      src={thumb.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${thumb.gradient} flex items-center justify-center`}>
                      {modeInfo && <FocusModeIcon modeId={modeInfo.id} size={24} className="text-white" />}
                    </div>
                  )}
                  {post.visibility === "private" && (
                    <div className="absolute top-1 left-1"><IconLock size={10} className="text-white drop-shadow" /></div>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div className="shrink-0 h-4" />
      </div>
      </div>

      {/* Post detail modal — full screen vertical scroll */}
      {selectedIndex !== null && (
        <>
          <div ref={swipePost.bgRef} className="fixed inset-0 bg-black z-40" />
          <div className="fixed inset-0 z-40 flex justify-center">
            <div ref={swipePost.ref} className="relative w-full max-w-[430px] flex flex-col" style={{ paddingBottom: "3rem" }} {...swipePost.handlers}>

              {/* Scrollable posts — 白背景でカード間の隙間をなくし、listRoundedでなめらかに接続 */}
              <div
                ref={scrollRef}
                className="flex-1 w-full overflow-y-auto bg-white"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
              <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
              {filteredPosts.map((post, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === filteredPosts.length - 1;
                const listRounded = filteredPosts.length === 1 ? undefined : isFirst ? "top" : isLast ? "bottom" : "none";
                return (
                <div
                  key={post.id}
                  ref={idx === selectedIndex ? (el) => {
                    if (el) el.scrollIntoView({ block: "start" });
                  } : undefined}
                >
                  <PostCard
                    post={post}
                    listRounded={listRounded}
                    onDelete={() => {
                      setPosts((prev) => prev.filter((p) => p.id !== post.id));
                      setSelectedIndex(null);
                    }}
                  />
                </div>
              );
              })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Following list modal — full screen */}
      {showFollowing && (
        <>
          <div ref={swipeFollowing.bgRef} className="fixed inset-0 z-50 flex justify-center bg-black/40">
          <div ref={swipeFollowing.ref} className="w-full max-w-[430px] bg-forest flex flex-col min-h-dvh" {...swipeFollowing.handlers}>
            <div className="flex items-center justify-between p-4 border-b border-forest-light/20">
              <button onClick={() => setShowFollowing(false)} className="text-white/40">←</button>
              <h3 className="font-bold text-sm text-white/90">Following ({following.length})</h3>
              <div className="w-8" />
            </div>
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {loadingFollowing ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-orange" />
                </div>
              ) : followingProfiles.length === 0 ? (
                <p className="text-center text-white/40 py-8 text-sm">Not following anyone yet</p>
              ) : (
                followingProfiles.map((fp) => (
                  <button
                    key={fp.uid}
                    onClick={() => { setShowFollowing(false); router.push(`/user/${fp.uid}`); }}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-forest-light/10 active:bg-forest-light/10"
                  >
                    <Avatar
                      photoURL={fp.photoURL}
                      displayName={fp.displayName}
                      uid={fp.uid}
                      size={44}
                    />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-bold truncate text-white/90">{fp.displayName}</p>
                      <p className="text-xs text-white/40">
                        {fp.mainMode && FOCUS_MODES.find((m) => m.id === resolveMode(fp.mainMode || ""))?.label}
                        {fp.region && fp.showRegion !== false && ` · ${fp.region}`}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
          </div>
        </>
      )}

      <BottomNav onMyClick={selectedIndex !== null ? () => setSelectedIndex(null) : undefined} />
    </div>
  );
}
