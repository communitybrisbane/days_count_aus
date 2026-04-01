"use client";

import Image from "next/image";
import { FOCUS_MODES, resolveMode } from "@/lib/constants";
import { getPostThumb } from "@/lib/postUtils";
import { FocusModeIcon, IconLock } from "@/components/icons";
import type { Post } from "@/types";

interface Props {
  posts: Post[];
  onSelect: (index: number) => void;
}

export default function PostGrid({ posts, onSelect }: Props) {
  return (
    <div className="grid grid-cols-4">
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
              <Image src={thumb.url} alt="" fill className="object-cover" sizes="25vw" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${thumb.gradient} flex items-center justify-center`}>
                {modeInfo && <FocusModeIcon modeId={modeInfo.id} size={24} className="text-white" />}
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
