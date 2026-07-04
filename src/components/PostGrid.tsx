"use client";

import Image from "next/image";
import { FOCUS_MODES, resolveMode } from "@/lib/constants";
import { getPostThumb } from "@/lib/postUtils";
import { FocusModeIcon, IconLock } from "@/components/icons";
import type { Post } from "@/types";

interface Props {
  posts: Post[];
  onSelect: (index: number) => void;
  /** Overlay the diary text on tiles (used on My tab when "All" is selected) */
  showText?: boolean;
  /** Columns: 4 (default) or 2 (larger tiles, toggled by re-tapping All on My tab) */
  cols?: 2 | 4;
}

export default function PostGrid({ posts, onSelect, showText = false, cols = 4 }: Props) {
  return (
    <div className={cols === 2 ? "grid grid-cols-2" : "grid grid-cols-4"}>
      {posts.map((post, idx) => {
        const thumb = getPostThumb(post);
        const modeInfo = FOCUS_MODES.find((m) => m.id === resolveMode(post.mode || ""));
        return (
          <button
            key={post.id}
            onClick={() => onSelect(idx)}
            className="relative aspect-square overflow-hidden"
          >
            {thumb.type === "image" ? (
              <Image src={thumb.url} alt="" fill className="object-cover" sizes={cols === 2 ? "50vw" : "25vw"} />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${thumb.gradient} flex items-center justify-center`}>
                {!showText && modeInfo && <FocusModeIcon modeId={modeInfo.id} size={24} className="text-white" />}
              </div>
            )}
            {showText && post.content && (
              <div className={`absolute inset-0 flex items-center justify-center p-1.5 ${thumb.type === "image" ? "bg-black/20" : ""}`}>
                <p className={`max-w-[80%] text-white text-center font-medium leading-snug drop-shadow ${cols === 2 ? "text-[10px]" : "text-[8px]"}`}>
                  {post.content}
                </p>
              </div>
            )}
            {post.visibility === "private" && (
              <div className="absolute top-1 left-1"><IconLock size={10} className="text-white drop-shadow" /></div>
            )}
          </button>
        );
      })}
    </div>
  );
}
