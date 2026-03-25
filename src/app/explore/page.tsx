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
import { FOCUS_MODES, MAIN_MODE_OPTIONS } from "@/lib/constants";
import PostCard from "@/components/PostCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import BottomNav from "@/components/layout/BottomNav";
import { IconEucalyptus, FocusModeIcon, IconSearch } from "@/components/icons";
import type { Post } from "@/types";
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
  const [searchTag, setSearchTag] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([]);
  const snapContainerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
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

        // Client-side filter: user/region OR tag match
        if (searchUserIds !== null || searchTag) {
          const tagQuery = searchTag ? searchTag.replace(/^#/, "") : "";
          newPosts = newPosts.filter((p) => {
            const matchUser = searchUserIds !== null && searchUserIds.includes(p.userId);
            const matchTag = tagQuery && p.tags?.some((t) => t.toLowerCase().replace(/^#/, "").includes(tagQuery));
            return matchUser || matchTag;
          });
        }

        // Score-based ranking (skip when searching — just show matches)
        if (searchUserIds === null && !searchTag) {
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
          setPosts((prev) => {
            const existing = new Set(prev.map((p) => p.id));
            const unique = newPosts.filter((p) => !existing.has(p.id));
            return [...prev, ...unique];
          });
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
    [filter, user, profile, privateData, following, searchUserIds, searchTag]
  );

  // Search handler — #tag, username (partial), or city/region
  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) {
      setSearchUserIds(null);
      setSearchTag(null);
      return;
    }

    // Tag search: starts with #
    if (trimmed.startsWith("#")) {
      setSearchUserIds(null);
      setSearchTag(trimmed);
      return;
    }

    // User/region search + also search tags
    setSearchTag(trimmed);
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

  // Initialize search from URL ?q= param (e.g. from hashtag tap)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) {
      setSearchQuery(q);
      handleSearch(q);
      // Clean up URL without reload
      window.history.replaceState({}, "", "/explore");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute trending tags from loaded posts
  useEffect(() => {
    if (posts.length === 0) return;
    const counts = new Map<string, number>();
    posts.forEach((p) => {
      p.tags?.forEach((t) => {
        const key = t.toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
    const sorted = Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    setTrendingTags(sorted);
  }, [posts]);

  const refreshPosts = useCallback(() => {
    setPosts([]);
    lastDocRef.current = null;
    setHasMore(true);
    fetchPosts(true);
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
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
    const el = scrollAreaRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (
        el.scrollTop + el.clientHeight >= el.scrollHeight - 500 &&
        hasMore &&
        !loadingRef.current
      ) {
        fetchPosts();
      }
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
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
    <div className="h-dvh flex flex-col overflow-hidden" style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}>
      <div
        className="shrink-0 bg-forest/95 backdrop-blur-md z-10 border-b border-forest-light/20"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
      >
        {/* Search bar */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 bg-forest-light/20 rounded-full px-3 py-2">
            <IconSearch size={16} className="text-white/40 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchInput(sanitize(e.target.value))}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search by city, username, or #tag..."
              className="flex-1 bg-transparent text-sm outline-none placeholder-white/30 text-white"
            />
            {showWarn && <span className="text-red-400 text-[10px] font-bold shrink-0">English only</span>}
            {(searchQuery || filter || searchFocused) && (
              <button
                onClick={() => { setSearchQuery(""); setSearchUserIds(null); setSearchTag(null); setFilter(""); setSearchFocused(false); }}
                className="text-white/40 text-lg leading-none shrink-0 w-8 h-8 flex items-center justify-center"
              >
                &times;
              </button>
            )}
          </div>
        </div>
        {/* Mode filter chips — shown on search focus or when filter active */}
        {(searchFocused || filter) && (
          <div className="px-4 pb-2 space-y-1.5">
            <div className="flex gap-1.5">
              <button
                onClick={() => { setFilter(""); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium text-center transition-all ${
                  !filter ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
                }`}
              >
                All
              </button>
              {MAIN_MODE_OPTIONS.filter((m) => ["english", "skill", "adventure"].includes(m.id)).map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setFilter(m.id); setSearchFocused(false); }}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-sm font-medium transition-all ${
                    filter === m.id ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
                  }`}
                >
                  <FocusModeIcon modeId={m.id} size={14} /> {m.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {MAIN_MODE_OPTIONS.filter((m) => ["work", "chill"].includes(m.id)).map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setFilter(m.id); setSearchFocused(false); }}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-sm font-medium transition-all ${
                    filter === m.id ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
                  }`}
                >
                  <FocusModeIcon modeId={m.id} size={14} /> {m.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Trending tags — shown when focused, no query */}
        {searchFocused && !searchQuery && trendingTags.length > 0 && (
          <div className="px-4 pb-2">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">Trending</p>
            <div className="flex flex-wrap gap-1.5">
              {trendingTags.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() => { onSearchInput(tag); setSearchFocused(false); }}
                  className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/80 hover:bg-white/20 active:scale-95 transition-all"
                >
                  {tag} <span className="text-white/40">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide" ref={scrollAreaRef}>
        {posts.length === 0 && !loadingPosts && (
          <div className="text-center py-20">
            <div className="mb-4">
              <IconEucalyptus size={40} className="text-white/40 mx-auto" />
            </div>
            <p className="text-white/60">
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
          <div ref={swipe.ref} className="relative w-[min(100%,430px)] flex flex-col" style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }} {...swipe.handlers}>
            {/* Snap scroll container */}
            <div
              ref={snapContainerRef}
              className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="snap-start snap-always w-full flex items-center"
                  style={{ height: "calc(100dvh - 4rem - env(safe-area-inset-bottom, 0px))" }}
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
