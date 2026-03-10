"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  where,
  DocumentSnapshot,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { FOCUS_MODES } from "@/lib/constants";
import PostCard from "@/components/PostCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNav from "@/components/layout/BottomNav";
import { IconBoomerang, FocusModeIcon } from "@/components/icons";
import type { Post } from "@/types";

const PAGE_SIZE = 20;

export default function ExplorePage() {
  useAuthGuard({ requireProfile: false });
  const { user, profile, loading, following } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const lastDocRef = useRef<DocumentSnapshot | null>(null);
  const loadingRef = useRef(false);

  const fetchPosts = useCallback(
    async (reset = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoadingPosts(true);
      try {
        const constraints: QueryConstraint[] = [];
        constraints.push(where("status", "==", "active"));
        if (filter) {
          constraints.push(where("mode", "==", filter));
        }
        constraints.push(orderBy("createdAt", "desc"));
        if (!reset && lastDocRef.current) {
          constraints.push(startAfter(lastDocRef.current));
        }
        constraints.push(limit(PAGE_SIZE));

        const q = query(collection(db, "posts"), ...constraints);
        const snap = await getDocs(q);

        let newPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));

        newPosts = newPosts.filter(
          (p) => p.userId === user?.uid || p.visibility !== "private"
        );

        if (profile?.blockedUsers?.length) {
          newPosts = newPosts.filter(
            (p) => !profile.blockedUsers.includes(p.userId)
          );
        }

        if (following.length > 0) {
          const followedPosts = newPosts.filter((p) => following.includes(p.userId));
          const otherPosts = newPosts.filter((p) => !following.includes(p.userId));
          newPosts = [...followedPosts, ...otherPosts];
        }

        if (reset) {
          setPosts(newPosts);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
        }

        lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
        setHasMore(snap.docs.length === PAGE_SIZE);
      } catch (e) {
        console.error("Failed to fetch posts:", e);
      } finally {
        loadingRef.current = false;
        setLoadingPosts(false);
      }
    },
    [filter, user, profile, following]
  );

  useEffect(() => {
    if (user) {
      setPosts([]);
      lastDocRef.current = null;
      setHasMore(true);
      fetchPosts(true);
    }
  }, [user, filter, fetchPosts]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 &&
        hasMore &&
        !loadingRef.current
      ) {
        fetchPosts();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, fetchPosts]);

  const handleDelete = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <div className="min-h-dvh pb-20">
      <div className="sticky top-0 bg-white z-10 border-b border-gray-100">
        <h1 className="text-lg font-bold p-4 pb-2">Explore</h1>
        {/* Filter */}
        <div className="flex gap-1 px-4 pb-3 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <button
            onClick={() => setFilter("")}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
              !filter ? "bg-aussie-gold text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            All
          </button>
          {FOCUS_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setFilter(m.id)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                filter === m.id
                  ? "bg-aussie-gold text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              <FocusModeIcon modeId={m.id} size={12} className="inline-block align-middle" /> {m.description}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {posts.length === 0 && !loadingPosts && (
          <div className="text-center py-20">
            <div className="mb-4"><IconBoomerang size={40} className="text-gray-400 mx-auto" /></div>
            <p className="text-gray-500">Post your first entry and start counting!</p>
          </div>
        )}

        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onDelete={() => handleDelete(post.id)}
          />
        ))}

        {loadingPosts && <LoadingSpinner size="sm" />}
      </div>

      <BottomNav />
    </div>
  );
}
