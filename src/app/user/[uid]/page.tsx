"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserPosts } from "@/lib/services/posts";
import { fetchUserProfile, blockUser, unblockUser } from "@/lib/services/users";
import { FOCUS_MODES, GRADIENTS } from "@/lib/constants";
import { followUser, unfollowUser, getFollowingIds } from "@/lib/follow";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/PostCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNav from "@/components/layout/BottomNav";
import { FocusModeIcon, IconBan, IconLock } from "@/components/icons";
import ConfirmModal from "@/components/ConfirmModal";
import type { Post, UserProfile } from "@/types";
import { NO_SCROLLBAR_STYLE } from "@/types";
import { useSwipeDismiss } from "@/hooks/useSwipeDismiss";

export default function PublicProfilePage() {
  const { user, profile: myProfile, privateData, following, refreshFollowing, refreshProfile, optimisticFollow, optimisticUnfollow } = useAuth();
  const router = useRouter();
  const params = useParams();
  const uid = params.uid as string;
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [modeFilter, setModeFilter] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const swipe = useSwipeDismiss(() => setSelectedIndex(null));

  const isOwn = user?.uid === uid;

  useEffect(() => {
    async function load() {
      try {
        const [profile, allPosts] = await Promise.all([
          fetchUserProfile(uid),
          fetchUserPosts(uid, isOwn),
        ]);
        if (profile) setUserData(profile);
        setPosts(allPosts);
        try {
          const ids = await getFollowingIds(uid);
          setFollowingCount(ids.length);
        } catch {
          setFollowingCount(0);
        }
      } catch (e) {
        console.error("Failed to load user profile:", e);
      }
      setLoading(false);
    }
    load();
  }, [uid, isOwn]);

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!userData) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <p className="text-gray-400">User not found</p>
      </div>
    );
  }

  const totalLikes = posts.reduce((sum, p) => sum + (p.likeCount || 0), 0);
  const streak = userData.currentStreak ?? 0;
  const filteredPosts = modeFilter ? posts.filter((p) => p.mode === modeFilter) : posts;

  const getPostThumb = (post: Post) => {
    if (post.imageUrl) return { type: "image" as const, url: post.imageUrl };
    const gradientIdx = post.mode ? FOCUS_MODES.findIndex((m) => m.id === post.mode) : 0;
    return { type: "gradient" as const, gradient: GRADIENTS[gradientIdx >= 0 ? gradientIdx : 0] };
  };

  return (
    <div className="h-dvh pb-16 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto" style={NO_SCROLLBAR_STYLE}>
      {/* プロフィール — Instagram風中央レイアウト（myタブと統一） */}
      <div className="relative px-5 pb-4" style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top, 0px))" }}>
        {/* 戻るボタン — 右上 */}
        <button onClick={() => router.back()} className="absolute top-0 right-3 text-gray-400 w-10 h-10 flex items-center justify-center" style={{ marginTop: "max(1.5rem, env(safe-area-inset-top, 0px))" }}>
          ×
        </button>

        <div className="flex flex-col items-center pt-10">
          {/* アバター */}
          <Avatar
            photoURL={userData.photoURL}
            displayName={userData.displayName}
            uid={userData.uid}
            size={96}
          />

          {/* 名前 */}
          <h2 className="text-xl font-bold mt-3 truncate max-w-[80%] text-center">{userData.displayName}</h2>

          {/* モード・地域 — 横並び */}
          <div className="flex items-center justify-center gap-1.5 mt-2">
            {userData.mainMode && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                <FocusModeIcon modeId={userData.mainMode} size={12} />
                {FOCUS_MODES.find((m) => m.id === userData.mainMode)?.description}
              </span>
            )}
            {userData.region && userData.showRegion !== false && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                {userData.region}
              </span>
            )}
          </div>

          {/* ゴール */}
          {userData.goal && (
            <p className="text-lg font-bold text-gray-700 mt-2 text-center max-w-[85%] leading-snug">{userData.goal}</p>
          )}

          {/* Likes / Streak / Following */}
          <div className="flex gap-8 mt-4 text-center">
            <div>
              <p className="font-bold text-base">{totalLikes}</p>
              <p className="text-[11px] text-gray-400">Likes</p>
            </div>
            <div>
              <p className="font-bold text-base">{streak}</p>
              <p className="text-[11px] text-gray-400">Streak</p>
            </div>
            <div>
              <p className="font-bold text-base">{followingCount}</p>
              <p className="text-[11px] text-gray-400">Following</p>
            </div>
          </div>

          {/* Follow / Block */}
          {!isOwn && user && (
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={async () => {
                  if (following.includes(uid)) {
                    optimisticUnfollow(uid);
                    try {
                      await unfollowUser(user.uid, uid);
                    } catch {
                      optimisticFollow(uid);
                    }
                  } else {
                    optimisticFollow(uid);
                    try {
                      await followUser(user.uid, uid);
                    } catch {
                      optimisticUnfollow(uid);
                    }
                  }
                }}
                className={`px-6 py-1.5 rounded-full text-sm font-bold ${
                  following.includes(uid)
                    ? "border border-gray-300 text-gray-500"
                    : "bg-ocean-blue text-white"
                }`}
              >
                {following.includes(uid) ? "Following" : "Follow"}
              </button>
              {privateData?.blockedUsers?.includes(uid) ? (
                <button
                  onClick={async () => {
                    if (!confirm("Unblock this user?")) return;
                    await unblockUser(user.uid, uid);
                    await refreshProfile();
                  }}
                  className="text-[10px] text-red-400 px-2 py-1 border border-red-200 rounded-full active:bg-red-50"
                >
                  Blocked
                </button>
              ) : (
                <button
                  onClick={() => setShowBlockModal(true)}
                  className="p-1.5 rounded-full border border-gray-200 text-gray-400 active:bg-gray-100"
                >
                  <IconBan size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* モードアイコン — 投稿のすぐ上 */}
      <div className="flex justify-around px-4 py-4 bg-white/80">
        <button
          onClick={() => setModeFilter("")}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold ${
            !modeFilter ? "bg-aussie-gold text-white" : "bg-gray-100 text-gray-400"
          }`}
        >
          All
        </button>
        {FOCUS_MODES.map((m) => {
          const isWH = m.id === "enjoying" || m.id === "challenging";
          return (
          <button
            key={m.id}
            onClick={() => setModeFilter(m.id)}
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              modeFilter === m.id
                ? isWH ? "bg-aussie-gold/15 ring-2 ring-aussie-gold" : "bg-ocean-blue/15 ring-2 ring-ocean-blue"
                : isWH ? "bg-amber-50" : "bg-blue-50"
            }`}
          >
            <FocusModeIcon modeId={m.id} size={33} />
          </button>
          );
        })}
      </div>

      {/* 投稿グリッド */}
      <div className="flex-1 min-h-0">
        {filteredPosts.length === 0 ? (
          <p className="text-center text-gray-400 py-8">{modeFilter ? "No posts in this mode" : "No posts yet"}</p>
        ) : (
          <div className="grid grid-cols-4">
            {filteredPosts.map((post, idx) => {
              const thumb = getPostThumb(post);
              const modeInfo = FOCUS_MODES.find((m) => m.id === post.mode);
              return (
                <button
                  key={post.id}
                  onClick={() => setSelectedIndex(idx)}
                  className="relative aspect-square overflow-hidden"
                >
                  {thumb.type === "image" ? (
                    <img src={thumb.url} alt="" className="w-full h-full object-cover" />
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
      </div>
      </div>

      {/* Post detail modal */}
      {selectedIndex !== null && (
        <>
          <div ref={swipe.bgRef} className="fixed inset-0 bg-black z-40" />
          <div className="fixed inset-0 z-40 flex justify-center">
            <div ref={swipe.ref} className="relative w-full max-w-[430px] flex flex-col pb-14" {...swipe.handlers}>
              <div
                ref={scrollRef}
                className="flex-1 w-full overflow-y-auto bg-white"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
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

      {showBlockModal && (
        <ConfirmModal
          title="Block User"
          message={`Block ${userData.displayName}? You won't see their posts anymore.`}
          confirmLabel="Block"
          confirmVariant="danger"
          onConfirm={async () => {
            if (!user) return;
            await blockUser(user.uid, uid);
            await refreshProfile();
            setShowBlockModal(false);
            router.back();
          }}
          onCancel={() => setShowBlockModal(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}
