"use client";

import { useRef, useEffect } from "react";
import PostCard from "@/components/PostCard";
import { useSwipeDismiss } from "@/hooks/useSwipeDismiss";
import { NAV_HEIGHT } from "@/lib/constants";
import type { Post } from "@/types";

interface Props {
  posts: Post[];
  selectedIndex: number;
  onClose: () => void;
  onDelete: (postId: string) => void;
  /** "list" = header + scrollable list (mypage/user), "snap" = full-height snap scroll (explore) */
  variant?: "list" | "snap";
}

export default function PostDetailModal({ posts, selectedIndex, onClose, onDelete, variant = "list" }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const swipe = useSwipeDismiss(onClose);

  // Snap variant: scroll to selected post
  useEffect(() => {
    if (variant === "snap" && scrollRef.current) {
      const target = scrollRef.current.children[selectedIndex] as HTMLElement;
      if (target) target.scrollIntoView({ block: "start" });
    }
  }, [selectedIndex, variant]);

  if (variant === "snap") {
    return (
      <div ref={swipe.bgRef} className="fixed inset-0 bg-black z-40 flex justify-center animate-slide-up" role="dialog" aria-modal="true">
        <div ref={swipe.ref} className="relative w-[min(100%,430px)] flex flex-col" style={{ paddingBottom: NAV_HEIGHT }} {...swipe.handlers}>
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {posts.map((post) => (
              <div
                key={post.id}
                className="snap-start snap-always w-full flex items-center"
                style={{ height: `calc(100dvh - ${NAV_HEIGHT})` }}
              >
                <div className="bg-white w-full max-h-full overflow-y-auto rounded-2xl scrollbar-hide" style={{ scrollbarWidth: "none" }}>
                  <PostCard
                    post={post}
                    onDelete={() => onDelete(post.id)}
                    listRounded="none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // List variant (mypage / user page)
  return (
    <>
      <div ref={swipe.bgRef} className="fixed inset-0 bg-black z-40" aria-hidden="true" />
      <div className="fixed inset-0 z-40 flex justify-center" role="dialog" aria-modal="true">
        <div ref={swipe.ref} className="relative w-full max-w-[430px] flex flex-col" style={{ paddingBottom: NAV_HEIGHT }} {...swipe.handlers}>
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-2 py-2 bg-forest/95 backdrop-blur-md border-b border-forest-light/20" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-white/70 active:text-white"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Back">
                <path d="M13 4L7 10L13 16" />
              </svg>
            </button>
            <h2 className="text-sm font-bold text-white/90">Post</h2>
            <div className="w-10" />
          </div>

          {/* Scrollable posts */}
          <div
            ref={scrollRef}
            className="flex-1 w-full overflow-y-auto bg-white"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
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
                    onDelete={() => onDelete(post.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
