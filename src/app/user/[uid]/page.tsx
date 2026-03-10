"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { calculateLevel } from "@/lib/utils";
import { fetchUserPosts } from "@/lib/services/posts";
import { fetchUserProfile, blockUser } from "@/lib/services/users";
import { FOCUS_MODES } from "@/lib/constants";
import { followUser, unfollowUser, getFollowingIds } from "@/lib/follow";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/PostCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNav from "@/components/layout/BottomNav";
import { IconPin, FocusModeIcon, IconHeart, IconFire, IconDiary, IconUsers, IconBan } from "@/components/icons";
import ConfirmModal from "@/components/ConfirmModal";
import type { Post, UserProfile } from "@/types";

export default function PublicProfilePage() {
  const { user, profile: myProfile, following, refreshFollowing, refreshProfile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const uid = params.uid as string;
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showBlockModal, setShowBlockModal] = useState(false);

  const isOwn = user?.uid === uid;

  useEffect(() => {
    async function load() {
      const [profile, allPosts, ids] = await Promise.all([
        fetchUserProfile(uid),
        fetchUserPosts(uid),
        getFollowingIds(uid),
      ]);
      if (profile) setUserData(profile);
      setPosts(isOwn ? allPosts : allPosts.filter((p) => p.visibility !== "private"));
      setFollowingCount(ids.length);
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

  const level = calculateLevel(userData.totalXP);
  const totalLikes = posts.reduce((sum, p) => sum + (p.likeCount || 0), 0);
  const streak = userData.currentStreak ?? 0;

  return (
    <div className="min-h-dvh pb-20">
      {/* Close button */}
      <div className="flex justify-start px-4 pt-3">
        <button onClick={() => router.back()} className="bg-black/5 rounded-full w-8 h-8 flex items-center justify-center text-gray-500 active:bg-black/10">
          ×
        </button>
      </div>

      {/* 他者プロフィール — 2枚目レイアウト（Lv・タグ・地域の1行 → 区切り線 → 累計4項目 → 目標） */}
      <div className="flex flex-col items-center pb-2 px-4">
        <Avatar
          photoURL={userData.photoURL}
          displayName={userData.displayName}
          uid={userData.uid}
          size={72}
        />
        <h2 className="text-xl font-bold mt-2">{userData.displayName}</h2>
        <div className="flex items-center justify-center gap-1.5 mt-0.5 flex-wrap">
          <p className="text-ocean-blue font-bold text-sm">Lv.{level}</p>
          {userData.mainMode && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              <FocusModeIcon modeId={userData.mainMode} size={12} className="inline-block align-middle mr-0.5" />
              {FOCUS_MODES.find((m) => m.id === userData.mainMode)?.description}
            </span>
          )}
          {userData.region && (
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <IconPin size={12} /> {userData.region}
            </span>
          )}
        </div>
        {!isOwn && user && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={async () => {
                if (following.includes(uid)) {
                  await unfollowUser(user.uid, uid);
                } else {
                  await followUser(user.uid, uid);
                }
                await refreshFollowing();
              }}
              className={`px-5 py-1.5 rounded-full text-sm font-bold ${
                following.includes(uid)
                  ? "border border-gray-300 text-gray-500"
                  : "bg-ocean-blue text-white"
              }`}
            >
              {following.includes(uid) ? "Following" : "Follow"}
            </button>
            {myProfile?.blockedUsers?.includes(uid) ? (
              <span className="text-xs text-red-400 px-3 py-1.5 border border-red-200 rounded-full">Blocked</span>
            ) : (
              <button
                onClick={() => setShowBlockModal(true)}
                className="p-1.5 rounded-full border border-gray-200 text-gray-400 active:bg-gray-100"
              >
                <IconBan size={16} />
              </button>
            )}
          </div>
        )}

        {/* 区切り線 */}
        <div className="w-full max-w-[200px] border-t border-gray-200 my-3" />

        {/* 累計（Likes / Streak / Posts / Following）— マイページと同じ見え方 */}
        <div className="flex gap-4 text-center">
          <div>
            <p className="font-bold flex items-center justify-center gap-1"><IconHeart size={14} className="text-pink-500" /> {totalLikes}</p>
            <p className="text-xs text-gray-400">Likes</p>
          </div>
          <div>
            <p className="font-bold flex items-center justify-center gap-1"><IconFire size={14} className="text-outback-clay" /> {streak}</p>
            <p className="text-xs text-gray-400">Streak</p>
          </div>
          <div>
            <p className="font-bold flex items-center justify-center gap-1"><IconDiary size={14} className="text-ocean-blue" /> {posts.length}</p>
            <p className="text-xs text-gray-400">Posts</p>
          </div>
          <div>
            <p className="font-bold flex items-center justify-center gap-1"><IconUsers size={14} className="text-ocean-blue" /> {followingCount}</p>
            <p className="text-xs text-gray-400">Following</p>
          </div>
        </div>

        {userData.goal && (
          <p className="text-sm text-gray-500 mt-2 text-center">{userData.goal}</p>
        )}
      </div>

      <div className="px-4 space-y-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} showActions={true} />
        ))}
      </div>

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
