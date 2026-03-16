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
import { IconEucalyptus, FocusModeIcon, IconSearch } from "@/components/icons";
import type { Post } from "@/types";
import AsciiWarn from "@/components/AsciiWarn";
import { useAsciiInput } from "@/hooks/useAsciiInput";
import { useSwipeDismiss } from "@/hooks/useSwipeDismiss";
import { rankPosts, markSeen } from "@/lib/feedScore";

const PAGE_SIZE = 20;

export default function ExplorePage() {
  useAuthGuard({ requireProfile: false });
  const { user, profile, privateData, loading, following } = useAuth();
  const { showWarn, sanitize } = useAsciiInput();
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
  const swipe = useSwipeDismiss(() => setSelectedIndex(null));

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

        // Client-side filter by searched user IDs
        if (searchUserIds !== null) {
          newPosts = newPosts.filter((p) => searchUserIds.includes(p.userId));
        }

        // Score-based ranking (skip when searching — just show matches)
        if (searchUserIds === null) {
          newPosts = rankPosts(
            newPosts,
            following,
            profile?.mainMode || "",
            profile?.region || "",
          );
        }

        // Mark posts as seen
        markSeen(newPosts.map((p) => p.id));

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

  // Search handler — username (partial) or city/region
  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) {
      setSearchUserIds(null);
      return;
    }

    try {
      const usersRef = collection(db, "users");
      const snap = await getDocs(query(usersRef, limit(500)));

      const userIds = new Set<string>();
      snap.docs.forEach((d) => {
        const data = d.data();
        const name = (data.displayName || "").toLowerCase();
        const regionVisible = data.showRegion !== false;
        const region = regionVisible ? (data.region || "").toLowerCase() : "";
        if (name.includes(trimmed) || region.includes(trimmed)) {
          userIds.add(d.id);
        }
      });

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
      <AsciiWarn show={showWarn} />
      <div
        className="sticky top-0 bg-white z-10 border-b border-gray-100"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* Filter chips */}
        <div className="px-4 pt-3 pb-2 space-y-1.5">
          {/* Row 1: All + WH modes */}
          <div className="flex gap-1.5">
            <button
              onClick={() => { setFilter(""); setSearchQuery(""); setSearchUserIds(null); }}
              className={`flex-1 py-1.5 rounded-full text-sm font-medium text-center transition-all ${
                !filter ? "bg-aussie-gold text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              All
            </button>
            {FOCUS_MODES.filter((m) => m.id === "enjoying" || m.id === "challenging").map((m) => (
              <button
                key={m.id}
                onClick={() => { setFilter(m.id); setSearchQuery(""); setSearchUserIds(null); }}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-sm font-medium transition-all ${
                  filter === m.id ? "bg-aussie-gold text-white" : "bg-amber-50 text-amber-700"
                }`}
              >
                <FocusModeIcon modeId={m.id} size={14} /> {m.label}
              </button>
            ))}
          </div>
          {/* Row 2: Other modes */}
          <div className="flex gap-1.5">
            {FOCUS_MODES.filter((m) => m.id !== "enjoying" && m.id !== "challenging").map((m) => (
              <button
                key={m.id}
                onClick={() => { setFilter(m.id); setSearchQuery(""); setSearchUserIds(null); }}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-sm font-medium transition-all ${
                  filter === m.id ? "bg-ocean-blue text-white" : "bg-blue-50 text-blue-700"
                }`}
              >
                <FocusModeIcon modeId={m.id} size={14} /> {m.label}
              </button>
            ))}
          </div>
        </div>
        {/* Search bar */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2">
            <IconSearch size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchInput(sanitize(e.target.value))}
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
        <div ref={swipe.bgRef} className="fixed inset-0 bg-black z-40 flex justify-center animate-slide-up">
          <div ref={swipe.ref} className="relative w-[min(100%,430px)] flex flex-col pb-14" {...swipe.handlers}>
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
