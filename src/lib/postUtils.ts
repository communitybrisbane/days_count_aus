import { FOCUS_MODES, GRADIENTS, resolveMode } from "@/lib/constants";
import type { Post } from "@/types";

export type PostThumb =
  | { type: "image"; url: string }
  | { type: "gradient"; gradient: string };

/** Tailwind gradient classes for a (possibly legacy or empty) mode id */
export function modeGradient(mode: string): string {
  const idx = FOCUS_MODES.findIndex((m) => m.id === resolveMode(mode || ""));
  return GRADIENTS[idx >= 0 ? idx : 0];
}

export function getPostThumb(post: Post): PostThumb {
  if (post.imageUrl) return { type: "image", url: post.imageUrl };
  return { type: "gradient", gradient: modeGradient(post.mode || "") };
}
