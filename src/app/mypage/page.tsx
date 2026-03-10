"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { calculateLevel, levelProgress, getDayCount, formatDayCount } from "@/lib/utils";
import { fetchUserPosts } from "@/lib/services/posts";
import { fetchAdminConfig } from "@/lib/services/users";
import { FOCUS_MODES, GRADIENTS } from "@/lib/constants";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/PostCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNav from "@/components/layout/BottomNav";
import { IconSettings, IconHeart, IconFire, IconPin, IconLock, IconDiary, IconUsers, FocusModeIcon } from "@/components/icons";
import type { Post } from "@/types";

export default function MyPage() {
  const { user, profile, loading } = useAuthGuard();
  const { following } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followingProfiles, setFollowingProfiles] = useState<any[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchUserPosts(user.uid).then((data) => {
      setPosts(data);
      setLoadingPosts(false);
    });
  }, [user]);

  const handleOpenFollowing = async () => {
    setShowFollowing(true);
    if (followingProfiles.length > 0 || following.length === 0) return;
    setLoadingFollowing(true);
    const profiles: any[] = [];
    for (const uid of following) {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) profiles.push({ uid, ...snap.data() });
    }
    setFollowingProfiles(profiles);
    setLoadingFollowing(false);
  };

  const handleCopyAIData = async () => {
    if (!profile || !user) return;

    // Fetch admin prompt template
    let aiPrompt = "";
    try {
      const configSnap = await getDoc(doc(db, "admin_config", "main"));
      if (configSnap.exists()) {
        aiPrompt = configSnap.data().ai_prompt_template || "";
      }
    } catch (e) {
      console.error(e);
    }

    // Last 7 days posts
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentPosts = posts.filter(
      (p) => p.createdAt?.toDate?.() && p.createdAt.toDate() >= weekAgo
    );

    const logs = recentPosts
      .map((p) => {
        const date = p.createdAt.toDate().toLocaleDateString("en-AU");
        const mode = FOCUS_MODES.find((m) => m.id === p.mode)?.description || p.mode;
        return `- ${date} [${mode}] ${p.content || p.contentFun || p.contentGrowth || "None"}`;
      })
      .join("\n");

    const modeCounts: Record<string, number> = {};
    recentPosts.forEach((p) => {
      modeCounts[p.mode] = (modeCounts[p.mode] || 0) + 1;
    });
    const modeCountStr = Object.entries(modeCounts)
      .map(([k, v]) => `${FOCUS_MODES.find((m) => m.id === k)?.description || k}: ${v}x`)
      .join(", ");

    const dayCount = getDayCount(profile.status, profile.departureDate, profile.returnStartDate);

    const text = `[Current Goal]
${profile.goal || "Not set"}

[Activity Log - Last 7 Days]
${logs || "No posts"}

Categories: ${modeCountStr || "None"}
XP Earned: ${recentPosts.length * 50}
Streak: ${profile.currentStreak} days
Current: ${formatDayCount(dayCount.label, dayCount.number)} / Lv.${calculateLevel(profile.totalXP)}

${aiPrompt ? `[AI Prompt]\n${aiPrompt}` : ""}`;

    try {
      await navigator.clipboard.writeText(text);
      alert("AI review data copied to clipboard!");
    } catch {
      alert("Failed to copy");
    }
  };

  if (loading || !profile) {
    return <LoadingSpinner fullScreen />;
  }

  const level = calculateLevel(profile.totalXP);
  const progress = levelProgress(profile.totalXP);
  const isSunday = new Date().getDay() === 0;

  const getPostThumb = (post: any) => {
    if (post.imageUrl) return { type: "image" as const, url: post.imageUrl };
    const gradientIdx = post.mode ? FOCUS_MODES.findIndex((m) => m.id === post.mode) : 0;
    return { type: "gradient" as const, gradient: GRADIENTS[gradientIdx >= 0 ? gradientIdx : 0] };
  };

  return (
    <div className="min-h-dvh pb-20">
      {/* Settings icon — top right */}
      <div className="flex justify-end px-4 pt-3">
        <button onClick={() => router.push("/settings")} className="text-gray-400 p-1">
          <IconSettings size={22} />
        </button>
      </div>

      {/* Profile header — compact spacing to maximize posts area */}
      <div className="flex flex-col items-center pb-2 px-4">
        <Avatar
          photoURL={profile.photoURL}
          displayName={profile.displayName}
          uid={user!.uid}
          size={72}
        />
        <h2 className="text-xl font-bold mt-2">{profile.displayName}</h2>
        <div className="flex items-center justify-center gap-1.5 mt-0.5 flex-wrap">
          <p className="text-ocean-blue font-bold text-sm">Lv.{level}</p>
          {profile.mainMode && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {profile.mainMode && <FocusModeIcon modeId={profile.mainMode} size={12} className="inline-block align-middle mr-0.5" />}{FOCUS_MODES.find((m) => m.id === profile.mainMode)?.description}
            </span>
          )}
          {profile.region && (
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <IconPin size={12} /> {profile.region}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-[200px] mt-1">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div
              className="bg-ocean-blue h-1 rounded-full"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-2 text-center">
          <div>
            <p className="font-bold flex items-center gap-1"><IconHeart size={14} className="text-pink-500" /> {posts.reduce((sum, p) => sum + (p.likeCount || 0), 0)}</p>
            <p className="text-xs text-gray-400">Likes</p>
          </div>
          <div>
            <p className="font-bold flex items-center gap-1"><IconFire size={14} className="text-outback-clay" /> {profile.currentStreak}</p>
            <p className="text-xs text-gray-400">Streak</p>
          </div>
          <div>
            <p className="font-bold flex items-center gap-1"><IconDiary size={14} className="text-ocean-blue" /> {posts.length}</p>
            <p className="text-xs text-gray-400">Posts</p>
          </div>
          <button onClick={handleOpenFollowing}>
            <p className="font-bold flex items-center gap-1"><IconUsers size={14} className="text-ocean-blue" /> {following.length}</p>
            <p className="text-xs text-gray-400">Following</p>
          </button>
        </div>

        {profile.goal && (
          <div className="mt-1 text-center">
            <p className="text-sm text-gray-500">{profile.goal}</p>
          </div>
        )}

        {isSunday && (
          <button
            onClick={handleCopyAIData}
            className="text-xs bg-ocean-blue text-white px-4 py-1.5 rounded-full mt-2"
          >
            Copy AI Review Data
          </button>
        )}
      </div>

      {/* Grid */}
      <div>
        {loadingPosts ? (
          <LoadingSpinner size="sm" />
        ) : posts.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No posts yet</p>
        ) : (
          <div className="grid grid-cols-4">
            {posts.map((post, idx) => {
              const thumb = getPostThumb(post);
              const modeInfo = FOCUS_MODES.find((m) => m.id === post.mode);
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
      </div>

      {/* Post detail modal — full screen vertical scroll */}
      {selectedIndex !== null && (
        <>
          <div className="fixed inset-0 bg-black z-40" />
          <div className="fixed inset-0 z-50 flex justify-center">
            <div className="relative w-full max-w-[430px] flex flex-col">
              {/* Close button */}
              <div className="absolute top-3 right-3 z-10">
                <button
                  onClick={() => setSelectedIndex(null)}
                  className="bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm"
                >
                  ×
                </button>
              </div>

              {/* Scrollable posts — 白背景でカード間の隙間をなくし、listRoundedでなめらかに接続 */}
              <div
                ref={scrollRef}
                className="flex-1 w-full overflow-y-auto bg-white"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
              <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
              {posts.map((post, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === posts.length - 1;
                const listRounded = posts.length === 1 ? undefined : isFirst ? "top" : isLast ? "bottom" : "none";
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
          <div className="fixed inset-0 z-50 flex justify-center bg-black/40">
          <div className="w-full max-w-[430px] bg-white flex flex-col min-h-dvh">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <button onClick={() => setShowFollowing(false)} className="text-gray-400">←</button>
              <h3 className="font-bold text-sm">Following ({following.length})</h3>
              <div className="w-8" />
            </div>
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {loadingFollowing ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-aussie-gold" />
                </div>
              ) : followingProfiles.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">Not following anyone yet</p>
              ) : (
                followingProfiles.map((fp) => (
                  <button
                    key={fp.uid}
                    onClick={() => { setShowFollowing(false); router.push(`/user/${fp.uid}`); }}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 active:bg-gray-50"
                  >
                    <Avatar
                      photoURL={fp.photoURL}
                      displayName={fp.displayName}
                      uid={fp.uid}
                      size={44}
                    />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-bold truncate">{fp.displayName}</p>
                      <p className="text-xs text-gray-400">
                        {fp.mainMode && FOCUS_MODES.find((m: any) => m.id === fp.mainMode)?.description}
                        {fp.region && ` · ${fp.region}`}
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

      <BottomNav />
    </div>
  );
}
