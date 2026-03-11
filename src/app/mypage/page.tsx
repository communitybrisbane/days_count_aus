"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { calculateLevel, getDayCount, formatDayCount } from "@/lib/utils";
import { fetchUserPosts } from "@/lib/services/posts";
import { FOCUS_MODES, GRADIENTS } from "@/lib/constants";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/PostCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNav from "@/components/layout/BottomNav";
import { IconSettings, IconHeart, IconFire, IconLock, IconUsers, FocusModeIcon } from "@/components/icons";
import type { Post } from "@/types";

export default function MyPage() {
  const { user, profile, loading } = useAuthGuard();
  const { following } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [modeFilter, setModeFilter] = useState("");
  const [showFollowing, setShowFollowing] = useState(false);
  const [followingProfiles, setFollowingProfiles] = useState<{ uid: string; displayName: string; photoURL: string; mainMode?: string; region?: string }[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!user) return;
    fetchUserPosts(user.uid, true).then((data) => {
      setPosts(data);
      setLoadingPosts(false);
    });
  }, [user]);

  const handleOpenFollowing = async () => {
    setShowFollowing(true);
    if (followingProfiles.length > 0 || following.length === 0) return;
    setLoadingFollowing(true);
    const profiles: any[] = [];
    const displayIds = following.slice(0, 50);
    for (const uid of displayIds) {
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
        return `- ${date} [${mode}] ${p.content || "None"}`;
      })
      .join("\n");

    const modeCounts: Record<string, number> = {};
    recentPosts.forEach((p) => {
      modeCounts[p.mode] = (modeCounts[p.mode] || 0) + 1;
    });
    const modeCountStr = Object.entries(modeCounts)
      .map(([k, v]) => `${FOCUS_MODES.find((m) => m.id === k)?.description || k}: ${v}x`)
      .join(", ");

    const ca = profile.createdAt as { toDate?: () => Date } | undefined;
    const createdAtDate = ca?.toDate?.() ?? null;
    const dayCount = getDayCount(profile.status || "pre-departure", profile.departureDate || "", profile.returnStartDate, createdAtDate);

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
  const isSunday = new Date().getDay() === 0;

  const filteredPosts = modeFilter ? posts.filter((p) => p.mode === modeFilter) : posts;

  const getPostThumb = (post: any) => {
    if (post.imageUrl) return { type: "image" as const, url: post.imageUrl };
    const gradientIdx = post.mode ? FOCUS_MODES.findIndex((m) => m.id === post.mode) : 0;
    return { type: "gradient" as const, gradient: GRADIENTS[gradientIdx >= 0 ? gradientIdx : 0] };
  };

  return (
    <div className="h-dvh pb-14 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" as any }}>
      {/* プロフィール — 空間をふんだんに使う */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-5">
          <Avatar
            photoURL={profile.photoURL}
            displayName={profile.displayName}
            uid={user!.uid}
            size={120}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold truncate">{profile.displayName}</h2>
              {profile.mainMode && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
                  <FocusModeIcon modeId={profile.mainMode} size={12} />
                  {FOCUS_MODES.find((m) => m.id === profile.mainMode)?.description}
                </span>
              )}
              <button onClick={() => router.push("/settings")} className="text-gray-400 p-1 shrink-0 ml-auto">
                <IconSettings size={20} />
              </button>
            </div>

            <div className="flex gap-6 mt-5 text-center">
              <div>
                <p className="font-bold flex items-center justify-center gap-1"><IconHeart size={16} className="text-pink-500" /> {posts.reduce((sum, p) => sum + (p.likeCount || 0), 0)}</p>
                <p className="text-xs text-gray-400">Likes</p>
              </div>
              <div>
                <p className="font-bold flex items-center justify-center gap-1"><IconFire size={16} className="text-outback-clay" /> {profile.currentStreak}</p>
                <p className="text-xs text-gray-400">Streak</p>
              </div>
              <button onClick={handleOpenFollowing}>
                <p className="font-bold flex items-center justify-center gap-1"><IconUsers size={16} className="text-ocean-blue" /> {following.length}</p>
                <p className="text-xs text-gray-400">Following</p>
              </button>
            </div>

            {isSunday && (
              <button
                onClick={handleCopyAIData}
                className="text-xs bg-ocean-blue text-white px-3 py-1.5 rounded-full mt-3"
              >
                Copy AI Review Data
              </button>
            )}
          </div>
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
        {FOCUS_MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setModeFilter(m.id)}
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              modeFilter === m.id ? "bg-aussie-gold/15 ring-2 ring-aussie-gold" : "bg-gray-100"
            }`}
          >
            <FocusModeIcon modeId={m.id} size={33} />
          </button>
        ))}
      </div>

      {/* 投稿グリッド */}
      <div className="flex-1 min-h-0">
        {loadingPosts ? (
          <LoadingSpinner size="sm" />
        ) : filteredPosts.length === 0 ? (
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
      </div>

      {/* Post detail modal — full screen vertical scroll */}
      {selectedIndex !== null && (
        <>
          <div className="fixed inset-0 bg-black z-40" />
          <div className="fixed inset-0 z-40 flex justify-center">
            <div className="relative w-full max-w-[430px] flex flex-col pb-14">

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
                        {fp.mainMode && FOCUS_MODES.find((m) => m.id === fp.mainMode)?.description}
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

      <BottomNav onMyClick={selectedIndex !== null ? () => setSelectedIndex(null) : undefined} />
    </div>
  );
}
