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
import { FOCUS_MODES, REGIONS } from "@/lib/constants";
import PostCard from "@/components/PostCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNav from "@/components/layout/BottomNav";
import { IconEucalyptus, FocusModeIcon, IconSearch } from "@/components/icons";
import type { Post } from "@/types";

const PAGE_SIZE = 20;

export default function ExplorePage() {
  useAuthGuard({ requireProfile: false });
  const { user, profile, privateData, loading, following } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUserIds, setSearchUserIds] = useState<string[] | null>(null);
  const snapContainerRef = useRef<HTMLDivElement>(null);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);
  const loadingRef = useRef(false);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCountRef = useRef(0);

  const fetchPosts = useCallback(
    async (reset = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoadingPosts(true);
      try {
        const constraints: QueryConstraint[] = [];
        constraints.push(where("status", "==", "active"));
        constraints.push(where("visibility", "==", "public"));
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

        if (privateData?.blockedUsers?.length) {
          newPosts = newPosts.filter(
            (p) => !privateData.blockedUsers.includes(p.userId)
          );
        }

        if (following.length > 0) {
          const followedPosts = newPosts.filter((p) => following.includes(p.userId));
          const otherPosts = newPosts.filter((p) => !following.includes(p.userId));
          newPosts = [...followedPosts, ...otherPosts];
        }

        // Client-side filter by searched user IDs
        if (searchUserIds !== null) {
          newPosts = newPosts.filter((p) => searchUserIds.includes(p.userId));
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
    [filter, user, profile, privateData, following, searchUserIds]
  );

  // Search handler — city or username only
  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) {
      setSearchUserIds(null);
      return;
    }

    const matchedRegion = REGIONS.find((r) => r.toLowerCase().includes(trimmed));

    try {
      const usersRef = collection(db, "users");
      const [nameSnap, regionSnap] = await Promise.all([
        getDocs(query(usersRef, where("displayName", ">=", trimmed), where("displayName", "<=", trimmed + "\uf8ff"), limit(50))),
        matchedRegion
          ? getDocs(query(usersRef, where("region", "==", matchedRegion), limit(50)))
          : Promise.resolve(null),
      ]);

      const userIds = new Set<string>();
      nameSnap.docs.forEach((d) => userIds.add(d.id));
      regionSnap?.docs.forEach((d) => userIds.add(d.id));

      setSearchUserIds(userIds.size > 0 ? Array.from(userIds) : []);
    } catch (e) {
      console.error("Search failed:", e);
    }
  }, []);

  const refreshPosts = useCallback(() => {
    setPosts([]);
    lastDocRef.current = null;
    setHasMore(true);
    fetchPosts(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [fetchPosts]);

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
    setSelectedIndex(null);
  };

  // Scroll to selected post when modal opens
  useEffect(() => {
    if (selectedIndex !== null && snapContainerRef.current) {
      const target = snapContainerRef.current.children[selectedIndex] as HTMLElement;
      if (target) target.scrollIntoView({ block: "start" });
    }
  }, [selectedIndex]);

  // Debounced search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => handleSearch(value), 400);
  };

  const handleExploreClick = () => {
    if (selectedIndex !== null) {
      setSelectedIndex(null);
    } else {
      refreshPosts();
    }
  };

  return (
    <div className="min-h-dvh pb-20">
      <div
        className="sticky top-0 bg-white z-10 border-b border-gray-100"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* Filter chips */}
        <div className="flex gap-1.5 px-4 pt-3 pb-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <button
            onClick={() => { setFilter(""); setSearchQuery(""); setSearchUserIds(null); }}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap ${
              !filter ? "bg-aussie-gold text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            All
          </button>
          {FOCUS_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => { setFilter(m.id); setSearchQuery(""); setSearchUserIds(null); }}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap ${
                filter === m.id
                  ? "bg-aussie-gold text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              <FocusModeIcon modeId={m.id} size={14} className="inline-block align-middle" /> {m.description}
            </button>
          ))}
        </div>
        {/* Search bar */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2">
            <IconSearch size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchInput(e.target.value.replace(/[^\x20-\x7E]/g, ""))}
              placeholder="Search by city or username..."
              className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSearchUserIds(null); }}
                className="text-gray-400 text-lg leading-none shrink-0 w-8 h-8 flex items-center justify-center"
              >
                &times;
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        {posts.length === 0 && !loadingPosts && (
          <div className="text-center py-20">
            <div className="mb-4">
              <IconEucalyptus size={40} className="text-gray-400 mx-auto" />
            </div>
            <p className="text-gray-500">
              {searchQuery ? "No posts found" : "Post your first entry and start counting!"}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-px">
          {posts.map((post, idx) => (
            <div
              key={post.id}
              className="cursor-pointer"
              onClick={() => {
                tapCountRef.current += 1;
                if (tapCountRef.current === 1) {
                  tapTimerRef.current = setTimeout(() => {
                    if (tapCountRef.current === 1) setSelectedIndex(idx);
                    tapCountRef.current = 0;
                  }, 300);
                }
              }}
            >
              <PostCard
                post={post}
                onDelete={() => handleDelete(post.id)}
                compact
                onDoubleTap={() => {
                  if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
                  tapCountRef.current = 0;
                }}
              />
            </div>
          ))}
        </div>

        {loadingPosts && <LoadingSpinner size="sm" />}
      </div>

      {/* Post detail modal — Shorts-style snap scroll */}
      {selectedIndex !== null && (
        <div className="fixed inset-0 bg-black z-40 flex justify-center animate-slide-up">
          <div className="relative w-[min(100%,430px)] flex flex-col pb-14">
            {/* Snap scroll container */}
            <div
              ref={snapContainerRef}
              className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="snap-start snap-always w-full h-[calc(100dvh-56px)] flex items-center"
                >
                  <div className="bg-white w-full max-h-full overflow-y-auto rounded-2xl scrollbar-hide" style={{ scrollbarWidth: "none" }}>
                    <PostCard
                      post={post}
                      onDelete={() => handleDelete(post.id)}
                      listRounded="none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <BottomNav onExploreClick={handleExploreClick} />
    </div>
  );
}
