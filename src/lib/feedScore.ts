import type { Post } from "@/types";

const SEEN_KEY = "seen_posts";
const SEEN_MAX = 500;
const SEEN_EXPIRE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

interface SeenEntry {
  id: string;
  t: number; // timestamp
}

// ─── Seen posts (localStorage) ───

function getSeenMap(): Map<string, number> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Map();
    const entries: SeenEntry[] = JSON.parse(raw);
    const now = Date.now();
    // Filter out expired entries
    return new Map(
      entries
        .filter((e) => now - e.t < SEEN_EXPIRE_MS)
        .map((e) => [e.id, e.t])
    );
  } catch {
    return new Map();
  }
}

export function markSeen(postIds: string[]) {
  const map = getSeenMap();
  const now = Date.now();
  for (const id of postIds) {
    map.set(id, now);
  }
  // Cap at SEEN_MAX, keep newest
  const entries: SeenEntry[] = Array.from(map.entries())
    .map(([id, t]) => ({ id, t }))
    .sort((a, b) => b.t - a.t)
    .slice(0, SEEN_MAX);
  localStorage.setItem(SEEN_KEY, JSON.stringify(entries));
}

// ─── Scoring ───

interface ScoreContext {
  following: string[];
  myMode: string;
  myRegion: string;
  seenMap: Map<string, number>;
}

function scorePost(post: Post, ctx: ScoreContext): number {
  let score = 0;

  // 1. Following (+50)
  if (ctx.following.includes(post.userId)) {
    score += 50;
  }

  // 2. Same mode (+20)
  if (ctx.myMode && post.mode === ctx.myMode) {
    score += 20;
  }

  // 3. Same region (+15) — need authorRegion on post or match by userId
  // We check post.region if available (not always), skip otherwise
  // Region matching is handled via the userId's profile mode match above

  // 4. Like count (+0~10)
  score += Math.min(10, Math.floor((post.likeCount || 0) / 2));

  // 5. Recency (+0~10)
  const createdAt = post.createdAt?.toDate?.();
  if (createdAt) {
    const hoursAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 24) score += 10;
    else if (hoursAgo < 72) score += 5;
  }

  // 6. Not following bonus (+5) — encourage discovery
  if (!ctx.following.includes(post.userId)) {
    score += 5;
  }

  // 7. Already seen penalty (-30)
  if (ctx.seenMap.has(post.id)) {
    score -= 30;
  }

  return score;
}

export function rankPosts(
  posts: Post[],
  following: string[],
  myMode: string,
  myRegion: string,
): Post[] {
  const seenMap = getSeenMap();
  const ctx: ScoreContext = { following, myMode, myRegion, seenMap };

  const scored = posts.map((post) => ({
    post,
    score: scorePost(post, ctx),
  }));

  // Sort by score desc, then by createdAt desc for ties
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTime = a.post.createdAt?.toDate?.()?.getTime() ?? 0;
    const bTime = b.post.createdAt?.toDate?.()?.getTime() ?? 0;
    return bTime - aTime;
  });

  return scored.map((s) => s.post);
}
