import type { Post } from "@/types";
import { resolveMode } from "@/lib/constants";

const SEEN_KEY = "seen_posts";
const SEEN_MAX = 500;
const SEEN_EXPIRE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const INTERACT_KEY = "feed_interactions";
const INTERACT_MAX = 300;
const INTERACT_EXPIRE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const INTERACT_HALF_LIFE_DAYS = 14; // older interactions count less

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
  if (postIds.length === 0) return;
  const map = getSeenMap();
  const now = Date.now();
  for (const id of postIds) {
    // Keep the first-seen timestamp so repeat impressions don't refresh the penalty window
    if (!map.has(id)) map.set(id, now);
  }
  // Cap at SEEN_MAX, keep newest
  const entries: SeenEntry[] = Array.from(map.entries())
    .map(([id, t]) => ({ id, t }))
    .sort((a, b) => b.t - a.t)
    .slice(0, SEEN_MAX);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(entries));
  } catch {
    /* storage full — skip */
  }
}

// ─── Interaction history (localStorage) ───
// Instagram-style affinity signals: every like / detail view teaches the
// ranker which authors and tags this user cares about.

type InteractionType = "like" | "view";

interface InteractionEntry {
  a: string; // author userId
  g: string[]; // tags
  w: number; // weight (like=3, view=1)
  t: number; // timestamp
}

const INTERACTION_WEIGHT: Record<InteractionType, number> = {
  like: 3,
  view: 1,
};

function getInteractions(): InteractionEntry[] {
  try {
    const raw = localStorage.getItem(INTERACT_KEY);
    if (!raw) return [];
    const entries: InteractionEntry[] = JSON.parse(raw);
    const now = Date.now();
    return entries.filter((e) => now - e.t < INTERACT_EXPIRE_MS);
  } catch {
    return [];
  }
}

export function recordInteraction(post: Post, type: InteractionType) {
  const entries = getInteractions();
  entries.push({
    a: post.userId,
    g: (post.tags || []).map((t) => t.toLowerCase().replace(/^#/, "")),
    w: INTERACTION_WEIGHT[type],
    t: Date.now(),
  });
  const capped = entries
    .sort((a, b) => b.t - a.t)
    .slice(0, INTERACT_MAX);
  try {
    localStorage.setItem(INTERACT_KEY, JSON.stringify(capped));
  } catch {
    /* storage full — skip */
  }
}

interface AffinityProfile {
  authors: Map<string, number>;
  tags: Map<string, number>;
}

function buildAffinity(): AffinityProfile {
  const authors = new Map<string, number>();
  const tags = new Map<string, number>();
  const now = Date.now();
  for (const e of getInteractions()) {
    const daysAgo = (now - e.t) / (24 * 60 * 60 * 1000);
    // Exponential decay: an interaction 2 weeks old counts half
    const w = e.w * Math.pow(0.5, daysAgo / INTERACT_HALF_LIFE_DAYS);
    authors.set(e.a, (authors.get(e.a) || 0) + w);
    for (const tag of e.g) {
      tags.set(tag, (tags.get(tag) || 0) + w);
    }
  }
  return { authors, tags };
}

// ─── Scoring ───
// Signal groups modeled on Instagram's feed ranking:
//  1. Affinity      — relationship with the author (follow + interaction history)
//  2. Interest      — content match (tags / mode / region)
//  3. Engagement    — time-decayed like velocity ("trending now", not "popular once")
//  4. Recency       — freshness decay
//  5. Seen state    — impression-based demotion
// Plus post-pass rules: author diversity + fresh-post exploration slots.

interface ScoreContext {
  following: string[];
  myUid: string;
  myMode: string;
  myRegion: string;
  seenMap: Map<string, number>;
  affinity: AffinityProfile;
  jitterSalt: string;
}

function hoursSince(post: Post): number | null {
  const createdAt = post.createdAt?.toDate?.();
  if (!createdAt) return null;
  return (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
}

// Small deterministic hash → 0..(mod-1). Stable within a day so the feed
// doesn't reshuffle on every refresh, but varies day to day.
function jitter(id: string, salt: string, mod: number): number {
  let h = 0;
  const s = id + salt;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % mod;
}

function scorePost(post: Post, ctx: ScoreContext): number {
  let score = 0;

  // ── 1. Affinity ──
  if (ctx.following.includes(post.userId)) {
    score += 25;
  }
  const authorAff = ctx.affinity.authors.get(post.userId) || 0;
  if (authorAff > 0 && post.userId !== ctx.myUid) {
    // log-scaled: 1 like ≈ +11, heavy interaction caps at +20
    score += Math.min(20, 8 * Math.log2(1 + authorAff));
  }

  // ── 2. Interest ──
  if (ctx.myMode && resolveMode(post.mode) === resolveMode(ctx.myMode)) {
    score += 10;
  }
  if (ctx.myRegion && post.region && post.region === ctx.myRegion) {
    score += 8;
  }
  if (post.tags?.length && ctx.affinity.tags.size > 0) {
    let tagAff = 0;
    for (const tag of post.tags) {
      tagAff += ctx.affinity.tags.get(tag.toLowerCase().replace(/^#/, "")) || 0;
    }
    if (tagAff > 0) {
      score += Math.min(15, 5 * Math.log2(1 + tagAff));
    }
  }

  // ── 3. Engagement velocity (Hacker News-style time decay) ──
  const hoursAgo = hoursSince(post);
  if (hoursAgo !== null) {
    const velocity = (post.likeCount || 0) / Math.pow(hoursAgo + 2, 1.2);
    score += Math.min(20, velocity * 12);

    // ── 4. Recency: ~+15 fresh, ~+5 at 2 days, →0 after that ──
    score += 15 * Math.exp(-hoursAgo / 48);
  }

  // ── 5. Seen penalty (impression-based) ──
  if (ctx.seenMap.has(post.id)) {
    score -= 40;
  }

  // Mild discovery bonus so the feed isn't 100% follow-driven
  if (!ctx.following.includes(post.userId) && authorAff === 0) {
    score += 3;
  }

  // Deterministic per-day jitter (0..5) — breaks ties, varies the feed daily
  score += jitter(post.id, ctx.jitterSalt, 6);

  return score;
}

// ─── Post-pass 1: author diversity ───
// Instagram avoids consecutive posts from the same author. With a 2-column
// grid, keep the same author out of the previous 2 slots when possible.

function diversify(posts: Post[]): Post[] {
  const result: Post[] = [];
  const pool = [...posts];
  while (pool.length > 0) {
    const recent = result.slice(-2).map((p) => p.userId);
    let idx = pool.findIndex((p) => !recent.includes(p.userId));
    if (idx === -1) idx = 0; // only one author left — allow the run
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

// ─── Post-pass 2: fresh-post exploration slots ───
// New posts have no likes yet, so pure scoring buries them (cold-start).
// Reserve every 6th slot for an unseen post <24h old with few likes, so new
// posts are guaranteed impressions and get a chance to accumulate signal.

const FRESH_SLOT_INTERVAL = 6;

function injectFreshSlots(posts: Post[], seenMap: Map<string, number>): Post[] {
  const isFresh = (p: Post) => {
    if (seenMap.has(p.id)) return false;
    const h = hoursSince(p);
    return h !== null && h < 24 && (p.likeCount || 0) <= 2;
  };

  const result = [...posts];
  for (let slot = FRESH_SLOT_INTERVAL - 1; slot < result.length; slot += FRESH_SLOT_INTERVAL) {
    if (isFresh(result[slot])) continue;
    // Promote the highest-ranked fresh post sitting below this slot, preferring
    // one that won't land next to a same-author post (which would undo diversify)
    const neighbours = [result[slot - 1]?.userId, result[slot]?.userId];
    let idx = result.findIndex((p, i) => i > slot && isFresh(p) && !neighbours.includes(p.userId));
    if (idx === -1) idx = result.findIndex((p, i) => i > slot && isFresh(p));
    if (idx === -1) break; // no fresh posts left anywhere below
    const [fresh] = result.splice(idx, 1);
    result.splice(slot, 0, fresh);
  }
  return result;
}

export interface RankContext {
  following: string[];
  myUid?: string;
  myMode?: string;
  myRegion?: string;
}

export function rankPosts(posts: Post[], ctx: RankContext): Post[] {
  const seenMap = getSeenMap();
  const scoreCtx: ScoreContext = {
    following: ctx.following,
    myUid: ctx.myUid || "",
    myMode: ctx.myMode || "",
    myRegion: ctx.myRegion || "",
    seenMap,
    affinity: buildAffinity(),
    jitterSalt: new Date().toISOString().slice(0, 10),
  };

  const scored = posts.map((post) => ({
    post,
    score: scorePost(post, scoreCtx),
  }));

  // Sort by score desc, then by createdAt desc for ties
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTime = a.post.createdAt?.toDate?.()?.getTime() ?? 0;
    const bTime = b.post.createdAt?.toDate?.()?.getTime() ?? 0;
    return bTime - aTime;
  });

  const ranked = scored.map((s) => s.post);
  return injectFreshSlots(diversify(ranked), seenMap);
}
