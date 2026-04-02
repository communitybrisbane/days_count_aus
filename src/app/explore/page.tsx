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
import { MAIN_MODE_OPTIONS, NAV_HEIGHT } from "@/lib/constants";
import PostCard from "@/components/PostCard";
import dynamic from "next/dynamic";
const PostDetailModal = dynamic(() => import("@/components/PostDetailModal"), { ssr: false });
import LoadingSpinner from "@/components/LoadingSpinner";
import { ExploreGridSkeleton } from "@/components/Skeleton";
import BottomNav from "@/components/layout/BottomNav";
import { IconEucalyptus, IconSearch, FocusModeIcon } from "@/components/icons";
import type { Post } from "@/types";
import { useAsciiInput } from "@/hooks/useAsciiInput";
import { rankPosts, markSeen } from "@/lib/feedScore";

const PAGE_SIZE = 20;

type SortTab = "new" | "popular";

export default function ExplorePage() {
  useAuthGuard({ requireProfile: false });
  const { user, profile, privateData, loading, following } = useAuth();
  const { showWarn, sanitize } = useAsciiInput();
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [sortTab, setSortTab] = useState<SortTab>("new");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUserIds, setSearchUserIds] = useState<string[] | null>(null);
  const [searchTag, setSearchTag] = useState<string | null>(null);
  const [modeFilter, setModeFilter] = useState<string>("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);
  const loadingRef = useRef(false);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCountRef = useRef(0);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const privateDataRef = useRef(privateData);
  privateDataRef.current = privateData;
  const followingRef = useRef(following);
  followingRef.current = following;
  const fetchPosts = useCallback(
    async (reset = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoadingPosts(true);
      try {
        const constraints: QueryConstraint[] = [];
        constraints.push(where("status", "==", "active"));
        constraints.push(where("visibility", "==", "public"));
        if (modeFilter) {
          constraints.push(where("mode", "==", modeFilter));
        }
        if (sortTab === "popular") {
          constraints.push(orderBy("likeCount", "desc"));
        } else {
          constraints.push(orderBy("createdAt", "desc"));
        }
        if (!reset && lastDocRef.current) {
          constraints.push(startAfter(lastDocRef.current));
        }
        constraints.push(limit(PAGE_SIZE));

        const q = query(collection(db, "posts"), ...constraints);
        const snap = await getDocs(q);

        let newPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));

        if (privateDataRef.current?.blockedUsers?.length) {
          newPosts = newPosts.filter(
            (p) => !privateDataRef.current!.blockedUsers.includes(p.userId)
          );
        }

        if (privateDataRef.current?.reportedPosts?.length) {
          newPosts = newPosts.filter(
            (p) => !privateDataRef.current!.reportedPosts.includes(p.id)
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

        // Score-based ranking for "new" tab without search
        if (sortTab === "new" && searchUserIds === null && !searchTag) {
          newPosts = rankPosts(
            newPosts,
            followingRef.current,
            profileRef.current?.mainMode || "",
            profileRef.current?.region || "",
          );
        }

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
    [sortTab, modeFilter, searchUserIds, searchTag]
  );

  // Cached user list for search — fetch once, filter in memory
  const userCacheRef = useRef<{ uid: string; name: string; region: string }[] | null>(null);

  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) {
      setSearchUserIds(null);
      setSearchTag(null);
      return;
    }

    if (trimmed.startsWith("#")) {
      setSearchUserIds(null);
      setSearchTag(trimmed);
      return;
    }

    setSearchTag(trimmed);
    try {
      // Fetch user list once, reuse for subsequent searches
      if (!userCacheRef.current) {
        const snap = await getDocs(query(collection(db, "users"), limit(500)));
        userCacheRef.current = snap.docs.map((d) => {
          const data = d.data();
          const regionVisible = data.showRegion !== false;
          return {
            uid: d.id,
            name: (data.displayName || "").toLowerCase(),
            region: regionVisible ? (data.region || "").toLowerCase() : "",
          };
        });
      }
      const matched = userCacheRef.current.filter(
        (u) => u.name.includes(trimmed) || u.region.includes(trimmed)
      );
      setSearchUserIds(matched.length > 0 ? matched.map((u) => u.uid) : []);
    } catch (e) {
      console.error("Search failed:", e);
    }
  }, []);

  // Initialize search from URL ?q=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) {
      setSearchQuery(q);
      handleSearch(q);
      window.history.replaceState({}, "", "/explore");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshPosts = useCallback(() => {
    setPosts([]);
    lastDocRef.current = null;
    setHasMore(true);
    fetchPosts(true);
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [fetchPosts]);

  useEffect(() => {
    if (user) refreshPosts();
  }, [user, refreshPosts]);

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

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => handleSearch(value), 400);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  const handleExploreClick = () => {
    if (selectedIndex !== null) {
      setSelectedIndex(null);
    } else {
      refreshPosts();
    }
  };

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ paddingBottom: NAV_HEIGHT }}>
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
              placeholder="Search by city, username, or #tag..."
              className="flex-1 bg-transparent text-sm outline-none placeholder-white/30 text-white"
            />
            {showWarn && <span className="text-red-400 text-[10px] font-bold shrink-0">English only</span>}
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSearchUserIds(null); setSearchTag(null); }}
                className="text-white/40 text-lg leading-none shrink-0 w-8 h-8 flex items-center justify-center"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Sort tabs: New / Popular */}
        <div className="flex px-4 gap-2 pb-2">
          {(["new", "popular"] as SortTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setSortTab(tab)}
              className={`flex-1 py-1.5 rounded-full text-xs font-bold text-center transition-all ${
                sortTab === tab
                  ? "bg-accent-orange text-white"
                  : "bg-forest-light/20 text-white/50"
              }`}
            >
              {tab === "new" ? "New" : "Popular"}
            </button>
          ))}
        </div>

        {/* Mode filter tabs */}
        <div className="flex px-4 gap-1.5 pb-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setModeFilter("")}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              !modeFilter ? "bg-white text-forest" : "bg-forest-light/20 text-white/50"
            }`}
          >
            All
          </button>
          {MAIN_MODE_OPTIONS.map((m) => (
            <button
              key={m.id}
              onClick={() => setModeFilter(modeFilter === m.id ? "" : m.id)}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                modeFilter === m.id ? "bg-white text-forest" : "bg-forest-light/20 text-white/50"
              }`}
            >
              <FocusModeIcon modeId={m.id} size={13} />
              {m.label}
            </button>
          ))}
        </div>
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

        {loadingPosts && posts.length === 0 ? <ExploreGridSkeleton /> : loadingPosts && <LoadingSpinner size="sm" />}
      </div>

      {selectedIndex !== null && (
        <PostDetailModal
          posts={posts}
          selectedIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onDelete={handleDelete}
          variant="snap"
        />
      )}

      <BottomNav onExploreClick={handleExploreClick} />
    </div>
  );
}
