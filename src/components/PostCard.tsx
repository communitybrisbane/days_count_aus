"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  Timestamp,
  collection,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { FOCUS_MODES, GRADIENTS, DAILY_LIKE_LIMIT, LIKE_SEND_XP, LIKE_RECEIVE_XP, NAV_HEIGHT, resolveMode } from "@/lib/constants";
import { followUser, unfollowUser } from "@/lib/follow";
import Avatar from "./Avatar";
import XPToast from "./XPToast";
import { FocusModeIcon, IconKangaroo, IconLock, IconEdit, IconTrash, IconFlag, IconBan } from "./icons";
import { reportPost } from "@/lib/services/posts";
import { blockUser } from "@/lib/services/users";
import type { Post } from "@/types";

// Global profile cache — shared across all PostCard instances, avoids duplicate fetches
const profileCache = new Map<string, { displayName: string; photoURL: string; uid: string; region?: string; showRegion?: boolean }>();

interface PostCardProps {
  post: Post;
  onDelete?: () => void;
  showActions?: boolean;
  listRounded?: "top" | "bottom" | "none";
  compact?: boolean;
  onDoubleTap?: () => void;
}

const roundedClass = (listRounded?: "top" | "bottom" | "none") => {
  if (!listRounded) return "rounded-2xl";
  if (listRounded === "top") return "rounded-t-2xl";
  if (listRounded === "bottom") return "rounded-b-2xl";
  return "rounded-none";
};

function PostCard({ post, onDelete, showActions = true, listRounded, compact = false, onDoubleTap }: PostCardProps) {
  const { user, profile, following, refreshProfile, optimisticFollow, optimisticUnfollow } = useAuth();
  const [authorProfile, setAuthorProfile] = useState<{ displayName: string; photoURL: string; uid: string; region?: string; showRegion?: boolean } | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [isEditable, setIsEditable] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showXP, setShowXP] = useState(false);
  const [xpGained, setXpGained] = useState(0);

  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const [heartPos, setHeartPos] = useState<{ x: number; y: number } | null>(null);
  const [showLikeToast, setShowLikeToast] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [likers, setLikers] = useState<{ uid: string; displayName: string; photoURL: string }[]>([]);
  const [loadingLikers, setLoadingLikers] = useState(false);
  const [recentLikers, setRecentLikers] = useState<{ uid: string; photoURL: string }[]>([]);
  const [reportStatus, setReportStatus] = useState<"" | "sending" | "done" | "already">("");
  const lastTapRef = useRef(0);
  const imageRef = useRef<HTMLDivElement>(null);
  const likingRef = useRef(false);

  const handleDoubleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      e.stopPropagation();
      const rect = imageRef.current?.getBoundingClientRect();
      if (rect) {
        const clientX = "touches" in e ? e.changedTouches?.[0]?.clientX ?? rect.left + rect.width / 2 : (e as React.MouseEvent).clientX;
        const clientY = "touches" in e ? e.changedTouches?.[0]?.clientY ?? rect.top + rect.height / 2 : (e as React.MouseEvent).clientY;
        setHeartPos({ x: clientX - rect.left, y: clientY - rect.top });
      }
      if (!liked) handleLike();
      setShowDoubleTapHeart(true);
      setTimeout(() => setShowDoubleTapHeart(false), 900);
      onDoubleTap?.();
    }
    lastTapRef.current = now;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liked, user, profile, onDoubleTap]);

  const resolvedMode = resolveMode(post.mode || "");
  const modeInfo = useMemo(() => FOCUS_MODES.find((m) => m.id === resolvedMode), [resolvedMode]);
  const gradient = useMemo(() => {
    const idx = resolvedMode ? FOCUS_MODES.findIndex((m) => m.id === resolvedMode) : 0;
    return GRADIENTS[idx >= 0 ? idx : 0];
  }, [resolvedMode]);
  const uniqueRecentLikers = useMemo(() => recentLikers.filter((l, i, arr) => arr.findIndex((x) => x.uid === l.uid) === i), [recentLikers]);
  const uniqueLikers = useMemo(() => likers.filter((l, i, arr) => arr.findIndex((x) => x.uid === l.uid) === i), [likers]);

  useEffect(() => {
    async function fetchAuthor() {
      // Check global cache first
      const cached = profileCache.get(post.userId);
      if (cached) {
        setAuthorProfile(cached);
        return;
      }
      const snap = await getDoc(doc(db, "users", post.userId));
      if (snap.exists()) {
        const data = snap.data();
        const p = {
          displayName: data.displayName,
          photoURL: data.photoURL,
          uid: data.uid,
          region: data.region || "",
          showRegion: data.showRegion !== false,
        };
        profileCache.set(post.userId, p);
        setAuthorProfile(p);
      }
    }
    fetchAuthor();
  }, [post.userId]);

  useEffect(() => {
    if (!user) return;
    async function checkLike() {
      const likeDoc = await getDoc(doc(db, "posts", post.id, "likes", user!.uid));
      setLiked(likeDoc.exists());
    }
    checkLike();
  }, [user, post.id]);

  // Fetch recent likers for avatar preview (max 3) — uses global cache
  useEffect(() => {
    if (post.likeCount === 0) return;
    async function fetchRecentLikers() {
      try {
        const q = query(collection(db, "posts", post.id, "likes"), orderBy("createdAt", "desc"), limit(3));
        const snap = await getDocs(q);
        const profiles = await Promise.all(
          snap.docs.map(async (likeDoc) => {
            const cached = profileCache.get(likeDoc.id);
            if (cached) return { uid: likeDoc.id, photoURL: cached.photoURL };
            const userSnap = await getDoc(doc(db, "users", likeDoc.id));
            if (userSnap.exists()) {
              const data = userSnap.data();
              profileCache.set(likeDoc.id, { displayName: data.displayName, photoURL: data.photoURL, uid: data.uid, region: data.region || "", showRegion: data.showRegion !== false });
              return { uid: likeDoc.id, photoURL: data.photoURL || "" };
            }
            return { uid: likeDoc.id, photoURL: "" };
          })
        );
        setRecentLikers(profiles);
      } catch { /* ignore */ }
    }
    fetchRecentLikers();
  }, [post.id, post.likeCount]);

  useEffect(() => {
    if (post.editableUntil) {
      const deadline = post.editableUntil.toDate();
      setIsEditable(new Date() < deadline && post.userId === user?.uid);
    }
  }, [post.editableUntil, user]);

  const handleLike = async () => {
    if (!user || !profile || likingRef.current) return;
    likingRef.current = true;

    const likeRef = doc(db, "posts", post.id, "likes", user.uid);
    const isOwnPost = post.userId === user.uid;
    const today = new Date().toISOString().slice(0, 10);
    const dailyCount = profile.lastLikeDate === today ? (profile.dailyLikeCount ?? 0) : 0;
    const hasXPQuota = dailyCount < DAILY_LIKE_LIMIT;

    if (liked) {
      // Optimistic update
      setLiked(false);
      setLikeCount((c) => c - 1);
      setRecentLikers((prev) => prev.filter((l) => l.uid !== user.uid));
      setLikers((prev) => prev.filter((l) => l.uid !== user.uid));
      try {
        await deleteDoc(likeRef);
        await updateDoc(doc(db, "posts", post.id), { likeCount: increment(-1) });
      } catch {
        // Revert on failure
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
    } else {
      // Optimistic update
      setLiked(true);
      setLikeCount((c) => c + 1);
      setRecentLikers((prev) => [{ uid: user.uid, photoURL: profile.photoURL || "" }, ...prev.filter((l) => l.uid !== user.uid)].slice(0, 3));
      setLikers((prev) => [{ uid: user.uid, displayName: profile.displayName || "You", photoURL: profile.photoURL || "" }, ...prev.filter((l) => l.uid !== user.uid)]);
      try {
        await setDoc(likeRef, { userId: user.uid, createdAt: Timestamp.now() });
        await updateDoc(doc(db, "posts", post.id), { likeCount: increment(1) });
        if (!isOwnPost && hasXPQuota) {
          try {
            await updateDoc(doc(db, "users", post.userId), { totalXP: increment(LIKE_RECEIVE_XP) });
          } catch (e) {
            console.error("[LIKE_XP] Failed to grant receive XP:", e);
          }
          try {
            await updateDoc(doc(db, "users", user.uid), {
              totalXP: increment(LIKE_SEND_XP),
              dailyLikeCount: profile.lastLikeDate === today ? increment(1) : 1,
              lastLikeDate: today,
            });
          } catch (e) {
            console.error("[LIKE_XP] Failed to grant send XP:", e);
          }
          setXpGained(LIKE_SEND_XP);
          setShowXP(true);
          setTimeout(() => setShowXP(false), 1500);
        } else if (!isOwnPost && !hasXPQuota) {
          setShowLikeToast(true);
          setTimeout(() => setShowLikeToast(false), 2000);
        }
      } catch (e) {
        console.error("[LIKE] Failed:", e);
        // Revert on failure
        setLiked(false);
        setLikeCount((c) => c - 1);
      }
    }
    likingRef.current = false;
  };

  const handleOpenLikers = async () => {
    setShowLikers(true);
    if (likers.length > 0) return;
    setLoadingLikers(true);
    try {
      const q = query(collection(db, "posts", post.id, "likes"), orderBy("createdAt", "desc"), limit(50));
      const snap = await getDocs(q);
      const profiles = await Promise.all(
        snap.docs.map(async (likeDoc) => {
          const cached = profileCache.get(likeDoc.id);
          if (cached) return { uid: likeDoc.id, displayName: cached.displayName, photoURL: cached.photoURL };
          const userSnap = await getDoc(doc(db, "users", likeDoc.id));
          if (userSnap.exists()) {
            const d = userSnap.data();
            profileCache.set(likeDoc.id, { displayName: d.displayName, photoURL: d.photoURL, uid: d.uid, region: d.region || "", showRegion: d.showRegion !== false });
            return { uid: likeDoc.id, displayName: d.displayName || "Unknown", photoURL: d.photoURL || "" };
          }
          return { uid: likeDoc.id, displayName: "Unknown", photoURL: "" };
        })
      );
      setLikers(profiles);
    } catch (e) {
      console.error("Failed to load likers:", e);
    }
    setLoadingLikers(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post?")) return;
    try {
      await deleteDoc(doc(db, "posts", post.id));
      onDelete?.();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  const handleReport = async () => {
    if (!user) return;
    if (!confirm("Report this post as inappropriate?")) return;
    setReportStatus("sending");
    try {
      const result = await reportPost(post.id, user.uid, "Inappropriate content");
      if (result === "already_reported") {
        setReportStatus("already");
      } else {
        setReportStatus("done");
      }
      setTimeout(() => setReportStatus(""), 3000);
    } catch (e) {
      console.error("Report failed:", e);
      setReportStatus("");
    }
  };

  const handleBlock = async () => {
    if (!user) return;
    if (!confirm(`Block this user? You won't see their posts anymore.`)) return;
    try {
      await blockUser(user.uid, post.userId);
      await refreshProfile();
      onDelete?.();
    } catch (e) {
      console.error("Block failed:", e);
    }
  };

  const createdDate = post.createdAt?.toDate?.()
    ? post.createdAt.toDate().toLocaleDateString("en-AU")
    : "";

  // Like pop animation — kangaroo only, no particles
  const HeartAnimation = ({ size }: { size: number }) => (
    <div
      className="absolute pointer-events-none z-10"
      style={{ left: heartPos?.x ?? "50%", top: heartPos?.y ?? "50%", transform: "translate(-50%, -50%)" }}
    >
      <div className="animate-like-burst">
        <IconKangaroo size={size} filled className="drop-shadow-lg" />
      </div>
    </div>
  );

  // Likers modal
  const LikersModal = () => (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setShowLikers(false)} aria-hidden="true" />
      <div className="fixed inset-x-0 z-[60] bg-white rounded-t-2xl max-h-[60dvh] flex flex-col animate-slide-up" style={{ bottom: NAV_HEIGHT }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-bold text-sm">Likes ({likeCount})</h3>
          <button onClick={() => setShowLikers(false)} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center" aria-label="Close">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {loadingLikers ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-orange" />
            </div>
          ) : likers.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No likes yet</p>
          ) : (
            uniqueLikers.map((liker) => (
              <Link
                key={liker.uid}
                href={`/user/${liker.uid}`}
                onClick={() => setShowLikers(false)}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 active:bg-gray-50"
              >
                <Avatar photoURL={liker.photoURL} displayName={liker.displayName} uid={liker.uid} size={40} />
                <p className="text-sm font-bold truncate">{liker.displayName}</p>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );

  // ─── Compact (Gallery) mode ───
  if (compact) {
    return (
      <div className="overflow-hidden bg-white relative group">
        <XPToast xp={xpGained} show={showXP} />
        <div ref={imageRef} className="relative" onClick={handleDoubleTap}>
          {post.imageUrl ? (
            <Image src={post.imageUrl} alt="Post" width={450} height={450} className="w-full aspect-square object-cover" />
          ) : (
            <div className={`w-full aspect-square bg-gradient-to-br ${gradient} flex items-center justify-center p-3`}>
              <p className="text-white text-center font-medium text-xs leading-snug line-clamp-4">
                {post.content}
              </p>
            </div>
          )}
          {showDoubleTapHeart && <HeartAnimation size={48} />}
          {post.visibility === "private" && (
            <div className="absolute top-1.5 left-1.5 bg-black/50 text-white rounded-full px-2 py-1">
              <IconLock size={14} />
            </div>
          )}
          {(post.region || authorProfile?.region) && authorProfile?.showRegion !== false && (
            <div className="absolute top-1.5 right-1.5 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-full">
              {post.region || authorProfile?.region}
            </div>
          )}
          <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-black/40 to-transparent" />
          <button
            onClick={(e) => { e.stopPropagation(); handleLike(); }}
            className="absolute bottom-1.5 left-2 flex items-center gap-1"
          >
            <IconKangaroo size={14} filled={liked} />
            <span className="text-[10px] text-white/80">{likeCount}</span>
          </button>
        </div>
      </div>
    );
  }

  const borderClass = listRounded === "top" || !listRounded ? "border border-gray-100" : "border border-t-0 border-gray-100";
  return (
    <div className={`bg-white shadow-sm overflow-hidden ${roundedClass(listRounded)} ${borderClass} relative`}>
      <XPToast xp={xpGained} show={showXP} />
      {showLikeToast && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-gray-800/80 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm animate-fade-in-out">
          XP limit reached — like still counted!
        </div>
      )}
      {/* Author header */}
      <div className="flex items-center gap-3 p-3">
        {authorProfile && (
          <Link href={`/user/${post.userId}`}>
            <Avatar
              photoURL={authorProfile.photoURL}
              displayName={authorProfile.displayName}
              uid={authorProfile.uid}
              size={36}
            />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/user/${post.userId}`} className="text-sm font-bold truncate">
              {authorProfile?.displayName || "..."}
            </Link>
            {user && post.userId !== user.uid && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (following.includes(post.userId)) {
                    optimisticUnfollow(post.userId);
                    try {
                      await unfollowUser(user.uid, post.userId);
                    } catch {
                      optimisticFollow(post.userId);
                    }
                  } else {
                    optimisticFollow(post.userId);
                    try {
                      await followUser(user.uid, post.userId);
                    } catch {
                      optimisticUnfollow(post.userId);
                    }
                  }
                }}
                className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${
                  following.includes(post.userId)
                    ? "border-gray-200 text-gray-400"
                    : "border-forest-mid text-forest-mid"
                }`}
              >
                {following.includes(post.userId) ? "Following" : "Follow"}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {createdDate} · {modeInfo && <FocusModeIcon modeId={modeInfo.id} size={12} className="inline-block align-middle mr-0.5" />}{modeInfo?.label}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {(post.region || authorProfile?.region) && authorProfile?.showRegion !== false && (
            <span className="text-[10px] bg-forest-mid/10 text-forest-mid px-2 py-0.5 rounded-full font-medium">
              {post.region || authorProfile?.region}
            </span>
          )}
          {post.phase && (
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-500">
              {post.dayNumber > 0 ? `D+${post.dayNumber}` : `D${post.dayNumber}`}
            </span>
          )}
        </div>
      </div>

      {/* Image or gradient card */}
      <div ref={imageRef} className="relative" onClick={handleDoubleTap}>
        {post.imageUrl ? (
          <Image src={post.imageUrl} alt="Post" width={450} height={450} className="w-full aspect-square object-cover" />
        ) : (
          <div className={`w-full aspect-[4/3] bg-gradient-to-br ${gradient} flex items-center justify-center p-6`}>
            <p className="text-white text-center font-medium text-sm leading-relaxed">
              {post.content}
            </p>
          </div>
        )}
        {showDoubleTapHeart && <HeartAnimation size={64} />}
        {post.visibility === "private" && (
          <div className="absolute top-2 left-2 bg-black/50 text-white rounded-full px-2 py-0.5 flex items-center gap-1 text-xs">
            <IconLock size={12} />
          </div>
        )}
      </div>

      {/* Report restricted notice */}
      {post.reportRestricted && (
        <div className="mx-3 mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <p className="text-[11px] text-red-600 font-medium">This post has been made private due to reports from other users.</p>
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        {(post.content) && (
          <p className="text-sm text-gray-700">
            {post.content}
          </p>
        )}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {post.tags.map((tag, i) => (
              <a
                key={i}
                href={`/explore?q=${encodeURIComponent(tag)}`}
                onClick={(e) => { e.stopPropagation(); }}
                className="text-[11px] text-accent-orange bg-accent-orange/8 rounded-full px-2 py-0.5 active:bg-accent-orange/20 transition-colors"
              >
                {tag}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleLike}
              className="flex items-center text-sm"
              aria-label="Like"
            >
              <IconKangaroo size={20} filled={liked} />
            </button>
            <div
              onClick={post.userId === user?.uid ? handleOpenLikers : undefined}
              className={`flex items-center gap-1.5 ${post.userId === user?.uid ? "cursor-pointer active:opacity-70" : ""}`}
            >
              {recentLikers.length > 0 && (
                <div className="flex items-center -space-x-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {uniqueRecentLikers.map((liker) => (
                    <Avatar key={liker.uid} photoURL={liker.photoURL} displayName="" uid={liker.uid} size={18} className="ring-1.5 ring-white shrink-0" />
                  ))}
                </div>
              )}
              {likeCount > 0 && (
                <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                  {likeCount} {likeCount === 1 ? "like" : "likes"}
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="text-gray-400 text-lg px-2 py-1 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="More options"
            >
              ···
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} aria-hidden="true" />
                <div className="absolute right-0 bottom-full mb-1 z-20 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-w-[120px]">
                  {post.userId === user?.uid ? (
                    <>
                      {isEditable && (
                        <Link
                          href={`/post/edit/${post.id}`}
                          className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                          onClick={() => setShowMenu(false)}
                        >
                          <span className="flex items-center gap-1.5"><IconEdit size={14} /> Edit</span>
                        </Link>
                      )}
                      <button
                        onClick={() => { setShowMenu(false); handleDelete(); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 active:bg-red-100"
                      >
                        <span className="flex items-center gap-1.5"><IconTrash size={14} /> Delete</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setShowMenu(false); handleBlock(); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                      >
                        <span className="flex items-center gap-1.5"><IconBan size={14} /> Block</span>
                      </button>
                      <button
                        onClick={() => { setShowMenu(false); handleReport(); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 active:bg-red-100"
                      >
                        <span className="flex items-center gap-1.5"><IconFlag size={14} /> Report</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Likers modal */}
      {showLikers && <LikersModal />}

      {/* Report status toast */}
      {reportStatus && (
        <div className="fixed bottom-20 inset-x-0 z-50 flex justify-center px-4 animate-fade-in">
          <div className={`px-5 py-3 rounded-2xl shadow-lg text-sm font-medium flex items-center gap-2 ${
            reportStatus === "done" ? "bg-forest-mid text-white" :
            reportStatus === "already" ? "bg-gray-700 text-white" :
            "bg-gray-700 text-white"
          }`}>
            {reportStatus === "sending" && (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Reporting...</>
            )}
            {reportStatus === "done" && (
              <><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10l4 4 8-8" /></svg>Report submitted. Thank you!</>
            )}
            {reportStatus === "already" && "You have already reported this post."}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(PostCard);
