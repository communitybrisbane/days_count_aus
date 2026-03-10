"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { FOCUS_MODES, GRADIENTS, DAILY_LIKE_LIMIT } from "@/lib/constants";
import { followUser, unfollowUser } from "@/lib/follow";
import Avatar from "./Avatar";
import XPToast from "./XPToast";
import { FocusModeIcon, IconHeart, IconLock, IconEdit, IconTrash, IconFlag, IconBan } from "./icons";
import { reportPost } from "@/lib/services/posts";
import { blockUser } from "@/lib/services/users";
import type { Post } from "@/types";

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

export default function PostCard({ post, onDelete, showActions = true, listRounded, compact = false, onDoubleTap }: PostCardProps) {
  const { user, profile, following, refreshFollowing, refreshProfile } = useAuth();
  const [authorProfile, setAuthorProfile] = useState<{ displayName: string; photoURL: string; uid: string; region?: string } | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [isEditable, setIsEditable] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showXP, setShowXP] = useState(false);
  const [xpGained, setXpGained] = useState(0);

  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const lastTapRef = useRef(0);

  const handleDoubleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      e.stopPropagation();
      if (!liked) handleLike();
      setShowDoubleTapHeart(true);
      setTimeout(() => setShowDoubleTapHeart(false), 800);
      onDoubleTap?.();
    }
    lastTapRef.current = now;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liked, user, profile, onDoubleTap]);

  const modeInfo = FOCUS_MODES.find((m) => m.id === post.mode);
  const gradientIdx = post.mode ? FOCUS_MODES.findIndex((m) => m.id === post.mode) : 0;
  const gradient = GRADIENTS[gradientIdx >= 0 ? gradientIdx : 0];

  useEffect(() => {
    async function fetchAuthor() {
      const snap = await getDoc(doc(db, "users", post.userId));
      if (snap.exists()) {
        const data = snap.data();
        setAuthorProfile({
          displayName: data.displayName,
          photoURL: data.photoURL,
          uid: data.uid,
          region: data.region || "",
        });
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

  useEffect(() => {
    if (post.editableUntil) {
      const deadline = post.editableUntil.toDate();
      setIsEditable(new Date() < deadline && post.userId === user?.uid);
    }
  }, [post.editableUntil, user]);

  const handleLike = async () => {
    if (!user || !profile) return;

    const likeRef = doc(db, "posts", post.id, "likes", user.uid);
    const isOwnPost = post.userId === user.uid;

    if (liked) {
      await deleteDoc(likeRef);
      await updateDoc(doc(db, "posts", post.id), { likeCount: increment(-1) });
      // Reverse XP (no XP change for own post likes)
      if (!isOwnPost) {
        await updateDoc(doc(db, "users", post.userId), { totalXP: increment(-10) });
        await updateDoc(doc(db, "users", user.uid), { totalXP: increment(-5) });
      }
      setLikeCount((c) => c - 1);
      setLiked(false);
    } else {
      // Check daily like limit
      const today = new Date().toISOString().slice(0, 10);
      if (profile.lastLikeDate === today && (profile.dailyLikeCount ?? 0) >= DAILY_LIKE_LIMIT) {
        alert(`You've reached today's like limit (${DAILY_LIKE_LIMIT})`);
        return;
      }

      await setDoc(likeRef, { userId: user.uid, createdAt: Timestamp.now() });
      await updateDoc(doc(db, "posts", post.id), { likeCount: increment(1) });
      // XP: no XP for liking own post
      if (!isOwnPost) {
        await updateDoc(doc(db, "users", post.userId), { totalXP: increment(10) });
        await updateDoc(doc(db, "users", user.uid), {
          totalXP: increment(5),
          dailyLikeCount: profile.lastLikeDate === today ? increment(1) : 1,
          lastLikeDate: today,
        });
      }
      setLikeCount((c) => c + 1);
      setLiked(true);
      if (!isOwnPost) {
        setXpGained(5);
        setShowXP(true);
        setTimeout(() => setShowXP(false), 1500);
      }
    }
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
    try {
      const result = await reportPost(post.id, user.uid, "Inappropriate content");
      if (result === "already_reported") {
        alert("You have already reported this post.");
      } else if (result === "auto_hidden") {
        alert("Thank you. This post has been hidden due to multiple reports.");
        onDelete?.();
      } else {
        alert("Thank you for reporting. We will review it.");
      }
    } catch (e) {
      console.error("Report failed:", e);
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

  // ─── Compact (Gallery) mode ───
  if (compact) {
    return (
      <div className="overflow-hidden bg-white relative group">
        <XPToast xp={xpGained} show={showXP} />
        {/* Image / gradient */}
        <div className="relative" onClick={handleDoubleTap}>
          {post.imageUrl ? (
            <img src={post.imageUrl} alt="Post" className="w-full aspect-square object-cover" />
          ) : (
            <div className={`w-full aspect-square bg-gradient-to-br ${gradient} flex items-center justify-center p-3`}>
              <p className="text-white text-center font-medium text-xs leading-snug line-clamp-4">
                {post.content}
              </p>
            </div>
          )}
          {/* Double-tap heart animation */}
          {showDoubleTapHeart && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <IconHeart size={48} filled className="text-red-500 animate-ping" />
            </div>
          )}
          {post.visibility === "private" && (
            <div className="absolute top-1.5 left-1.5 bg-black/50 text-white rounded-full px-2 py-1">
              <IconLock size={14} />
            </div>
          )}
          {/* Location badge — top right */}
          {authorProfile?.region && (
            <div className="absolute top-1.5 right-1.5 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-full">
              {authorProfile.region}
            </div>
          )}
          {/* Like button — bottom left */}
          <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-black/40 to-transparent" />
          <button
            onClick={(e) => { e.stopPropagation(); handleLike(); }}
            className="absolute bottom-1.5 left-2 flex items-center gap-1"
          >
            <span className={liked ? "text-red-500" : "text-white/80"}>
              <IconHeart size={14} filled={liked} />
            </span>
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
                    await unfollowUser(user.uid, post.userId);
                  } else {
                    await followUser(user.uid, post.userId);
                  }
                  await refreshFollowing();
                }}
                className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${
                  following.includes(post.userId)
                    ? "border-gray-200 text-gray-400"
                    : "border-ocean-blue text-ocean-blue"
                }`}
              >
                {following.includes(post.userId) ? "Following" : "Follow"}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {createdDate} · {modeInfo && <FocusModeIcon modeId={modeInfo.id} size={12} className="inline-block align-middle mr-0.5" />}{modeInfo?.description}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {authorProfile?.region && (
            <span className="text-[10px] bg-ocean-blue/10 text-ocean-blue px-2 py-0.5 rounded-full font-medium">
              {authorProfile.region}
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
      <div className="relative" onClick={handleDoubleTap}>
        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt="Post"
            className="w-full aspect-square object-cover"
          />
        ) : (
          <div
            className={`w-full aspect-[4/3] bg-gradient-to-br ${gradient} flex items-center justify-center p-6`}
          >
            <p className="text-white text-center font-medium text-sm leading-relaxed">
              {post.content}
            </p>
          </div>
        )}
        {/* Double-tap heart animation */}
        {showDoubleTapHeart && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <IconHeart size={64} filled className="text-red-500 animate-ping" />
          </div>
        )}
        {post.visibility === "private" && (
          <div className="absolute top-2 left-2 bg-black/50 text-white rounded-full px-2 py-0.5 flex items-center gap-1 text-xs">
            <IconLock size={12} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {(post.content) && (
          <p className="text-sm text-gray-700">
            {post.content}
          </p>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center justify-between px-3 pb-3">
          <button
            onClick={handleLike}
            className="flex items-center gap-1 text-sm"
          >
            <span className={liked ? "text-red-500" : "text-gray-400"}>
              <IconHeart size={18} filled={liked} />
            </span>
            <span className="text-gray-500">{likeCount}</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="text-gray-400 text-lg px-2 py-1 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              ···
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
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
    </div>
  );
}
