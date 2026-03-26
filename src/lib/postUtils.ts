import { FOCUS_MODES, GRADIENTS, resolveMode } from "@/lib/constants";
import type { Post } from "@/types";

export type PostThumb =
  | { type: "image"; url: string }
  | { type: "gradient"; gradient: string };

export function getPostThumb(post: Post): PostThumb {
  if (post.imageUrl) return { type: "image", url: post.imageUrl };
  const resolved = resolveMode(post.mode || "");
  const gradientIdx = resolved ? FOCUS_MODES.findIndex((m) => m.id === resolved) : 0;
  return { type: "gradient", gradient: GRADIENTS[gradientIdx >= 0 ? gradientIdx : 0] };
}
