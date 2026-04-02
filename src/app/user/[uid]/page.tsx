"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserPosts } from "@/lib/services/posts";
import { fetchUserProfile, blockUser, unblockUser, reportUser, isBlockedBy } from "@/lib/services/users";
import { fetchUserGroups } from "@/lib/groups";
import { FOCUS_MODES, resolveMode, NAV_HEIGHT } from "@/lib/constants";
import { followUser, unfollowUser, getFollowingIds } from "@/lib/follow";
import Avatar from "@/components/Avatar";
import dynamic from "next/dynamic";
const PostDetailModal = dynamic(() => import("@/components/PostDetailModal"), { ssr: false });
import PostGrid from "@/components/PostGrid";
import ProfileGroups from "@/components/ProfileGroups";
import ModeFilterBar from "@/components/ModeFilterBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNav from "@/components/layout/BottomNav";
import { FocusModeIcon, IconBan } from "@/components/icons";
import type { Post, UserProfile, Group } from "@/types";
import { NO_SCROLLBAR_STYLE } from "@/types";

export default function PublicProfilePage() {
  const { user, profile: myProfile, privateData, following, refreshFollowing, refreshProfile, optimisticFollow, optimisticUnfollow } = useAuth();
  const router = useRouter();
  const params = useParams();
  const uid = params.uid as string;
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showReportInput, setShowReportInput] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportImage, setReportImage] = useState<File | null>(null);
  const [reportImagePreview, setReportImagePreview] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const reportFileRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [modeFilter, setModeFilter] = useState("");
  const [blockedByTarget, setBlockedByTarget] = useState(false);

  const isOwn = user?.uid === uid;

  useEffect(() => {
    async function load() {
      try {
        // Check if this user has blocked the viewer
        if (user && !isOwn) {
          const blocked = await isBlockedBy(user.uid, uid);
          if (blocked) {
            setBlockedByTarget(true);
            setLoading(false);
            return;
          }
        }
        const [profile, allPosts] = await Promise.all([
          fetchUserProfile(uid),
          fetchUserPosts(uid, isOwn),
        ]);
        if (profile) {
          setUserData(profile);
          if (profile.groupIds?.length) {
            fetchUserGroups(profile.groupIds).then(setUserGroups).catch(() => {});
          }
        }
        const visiblePosts = !isOwn && privateData?.reportedPosts?.length
          ? allPosts.filter((p) => !privateData.reportedPosts.includes(p.id))
          : allPosts;
        setPosts(visiblePosts);
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
  }, [uid, isOwn, user]);

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (blockedByTarget) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-3">
        <p className="text-white/40">This user is not available</p>
        <button onClick={() => router.back()} className="text-sm text-white/30 border border-white/20 px-4 py-1.5 rounded-full">Go back</button>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <p className="text-white/40">User not found</p>
      </div>
    );
  }

  const totalLikes = posts.reduce((sum, p) => sum + (p.likeCount || 0), 0);
  const streak = userData.currentStreak ?? 0;
  const filteredPosts = modeFilter ? posts.filter((p) => resolveMode(p.mode) === modeFilter) : posts;

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto" style={NO_SCROLLBAR_STYLE}>
      {/* プロフィール — Instagram風中央レイアウト（myタブと統一） */}
      <div className="relative px-5 pb-4" style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top, 0px))" }}>
        {/* Geometric background for profile header */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-forest-light/15 rotate-45" />
          <div className="absolute bottom-0 -left-6 w-36 h-36 bg-forest-mid/10 -rotate-12" />
        </div>

        {/* 戻るボタン — 右上 */}
        <button onClick={() => router.back()} className="absolute top-0 right-3 text-white/40 w-10 h-10 flex items-center justify-center z-10" style={{ marginTop: "max(1.5rem, env(safe-area-inset-top, 0px))" }}>
          &times;
        </button>

        <div className="flex flex-col items-center pt-10 relative">
          {/* アバター */}
          <div className="ring-3 ring-accent-orange/40 rounded-full">
            <Avatar
              photoURL={userData.photoURL}
              displayName={userData.displayName}
              uid={userData.uid}
              size={96}
            />
          </div>

          {/* 名前 */}
          <h2 className="text-xl font-bold mt-3 truncate max-w-[80%] text-center text-white/90">{userData.displayName}</h2>

          {/* モード・地域 — 横並び */}
          <div className="flex items-center justify-center gap-1.5 mt-2">
            {userData.mainMode && (
              <span className="inline-flex items-center gap-1 text-xs text-white/60 bg-forest-light/30 px-2.5 py-0.5 rounded-full">
                <FocusModeIcon modeId={resolveMode(userData.mainMode)} size={12} />
                {FOCUS_MODES.find((m) => m.id === resolveMode(userData.mainMode))?.label}
              </span>
            )}
            {userData.region && userData.showRegion !== false && (
              <span className="text-xs text-white/60 bg-forest-light/30 px-2.5 py-0.5 rounded-full">
                {userData.region}
              </span>
            )}
          </div>

          {/* ゴール */}
          {userData.goal && (
            <p className="text-lg font-bold text-white/80 mt-2 text-center max-w-[85%] leading-snug">{userData.goal}</p>
          )}

          {/* Likes / Streak / Following */}
          <div className="flex gap-8 mt-4 text-center">
            <div>
              <p className="font-bold text-base text-white/90">{totalLikes}</p>
              <p className="text-[11px] text-white/40">Likes</p>
            </div>
            <div>
              <p className="font-bold text-base text-white/90">{streak}</p>
              <p className="text-[11px] text-white/40">Streak</p>
            </div>
            <div>
              <p className="font-bold text-base text-white/90">{followingCount}</p>
              <p className="text-[11px] text-white/40">Following</p>
            </div>
          </div>

          {/* Follow / Block */}
          {!isOwn && user && !myProfile?.restricted && (
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
                    ? "border border-white/30 text-white/60"
                    : "bg-forest-mid text-white"
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
                  onClick={() => setShowActionSheet(true)}
                  className="p-1.5 rounded-full border border-white/20 text-white/40 active:bg-forest-light/20"
                >
                  <IconBan size={14} />
                </button>
              )}
            </div>
          )}

          <ProfileGroups groups={userGroups} className="mt-4" />
        </div>
      </div>

      <ModeFilterBar value={modeFilter} onChange={setModeFilter} size={14} />

      {/* 投稿グリッド */}
      <div className="flex-1 min-h-0">
        {filteredPosts.length === 0 ? (
          <p className="text-center text-white/40 py-8">{modeFilter ? "No posts in this mode" : "No posts yet"}</p>
        ) : (
          <PostGrid posts={filteredPosts} onSelect={setSelectedIndex} />
        )}
        <div className="shrink-0" style={{ height: NAV_HEIGHT }} />
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

      {showActionSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowActionSheet(false)}>
          <div className="w-full max-w-md mx-4 space-y-2" style={{ marginBottom: `calc(${NAV_HEIGHT} + 1.5rem)` }} onClick={(e) => e.stopPropagation()}>
            <div className="bg-forest-mid/95 backdrop-blur-md rounded-2xl overflow-hidden">
              <button
                onClick={async () => {
                  if (!user) return;
                  await blockUser(user.uid, uid);
                  await Promise.all([refreshProfile(), refreshFollowing()]);
                  setShowActionSheet(false);
                  router.back();
                }}
                className="w-full py-3.5 text-sm font-semibold text-red-400 border-b border-white/10 active:bg-white/10"
              >
                Block
              </button>
              <button
                onClick={() => {
                  setShowActionSheet(false);
                  setShowReportInput(true);
                }}
                className="w-full py-3.5 text-sm font-semibold text-accent-orange active:bg-white/10"
              >
                Report
              </button>
            </div>
            <button
              onClick={() => setShowActionSheet(false)}
              className="w-full py-3.5 text-sm font-semibold text-white/80 bg-forest-mid/95 backdrop-blur-md rounded-2xl active:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showReportInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" onClick={() => { setShowReportInput(false); setReportReason(""); setReportImage(null); setReportImagePreview(""); }}>
          <div className="w-full max-w-sm bg-forest-mid/95 backdrop-blur-md rounded-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white/90 text-center">Report {userData.displayName}</h3>
            <input
              type="text"
              placeholder="Reason for report"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full border border-forest-light/30 bg-forest-light/10 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange placeholder-white/30"
              autoFocus
            />
            <div>
              <button
                onClick={() => reportFileRef.current?.click()}
                className="text-xs text-white/60 border border-forest-light/30 px-3 py-1.5 rounded-full active:bg-white/10"
              >
                {reportImagePreview ? "Change screenshot" : "Attach screenshot (required)"}
              </button>
              <input
                ref={reportFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setReportImage(file);
                  setReportImagePreview(URL.createObjectURL(file));
                }}
                className="hidden"
              />
              {reportImagePreview && (
                <img src={reportImagePreview} alt="" className="mt-2 w-20 h-20 object-cover rounded-lg border border-forest-light/30" />
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowReportInput(false); setReportReason(""); setReportImage(null); setReportImagePreview(""); }}
                className="flex-1 py-2.5 rounded-full text-sm text-white/60 border border-white/20"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!user || !reportReason.trim() || !reportImage || reporting) return;
                  setReporting(true);
                  try {
                    await reportUser(user.uid, uid, reportReason.trim(), reportImage);
                    setShowReportInput(false);
                    setReportReason("");
                    setReportImage(null);
                    setReportImagePreview("");
                    setReportSent(true);
                    setTimeout(() => setReportSent(false), 2500);
                  } catch (e) {
                    console.error("Failed to report:", e);
                  }
                  setReporting(false);
                }}
                disabled={!reportReason.trim() || !reportImage || reporting}
                className="flex-1 py-2.5 rounded-full text-sm font-bold bg-accent-orange text-white disabled:opacity-50"
              >
                {reporting ? "Sending..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reportSent && (
        <div className="fixed top-12 left-1/2 z-50 bg-forest-mid/95 backdrop-blur-md text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg animate-fade-in-out">
          Report sent
        </div>
      )}

      <BottomNav />
    </div>
  );
}
