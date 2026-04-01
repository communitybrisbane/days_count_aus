import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
  increment,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { POST_EDIT_WINDOW_MS } from "@/lib/constants";
import { getCurrentTuesday } from "@/lib/utils";
import type { Post } from "@/types";

export async function fetchUserPosts(uid: string, isOwn = false): Promise<Post[]> {
  const q = isOwn
    ? query(collection(db, "posts"), where("userId", "==", uid), orderBy("createdAt", "desc"), limit(100))
    : query(collection(db, "posts"), where("userId", "==", uid), where("status", "==", "active"), where("visibility", "==", "public"), orderBy("createdAt", "desc"), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
}

export async function fetchTotalLikesAndWeekly(uid: string) {
  // Fetch recent posts (limit 100) for like count
  const q = query(collection(db, "posts"), where("userId", "==", uid), where("status", "==", "active"), orderBy("createdAt", "desc"), limit(100));
  const snap = await getDocs(q);
  let totalLikes = 0;
  snap.docs.forEach((d) => {
    totalLikes += d.data().likeCount || 0;
  });

  // Weekly reset: Tuesday 00:00 local time — count unique days
  const tuesdayStart = getCurrentTuesday();
  const daysSet = new Set<string>();
  snap.docs.forEach((d) => {
    const ca = d.data().createdAt;
    if (ca?.toDate && ca.toDate() >= tuesdayStart) {
      daysSet.add(ca.toDate().toISOString().slice(0, 10));
    }
  });
  const weeklyPostCount = daysSet.size;

  return { totalLikes, weeklyPostCount };
}

/** Get post counts per week for the past N weeks (Tuesday reset), with mode breakdown */
export async function fetchWeeklyHistory(uid: string, weeks: number = 12): Promise<{ weekStart: Date; count: number; uniqueDays: number; modes: Record<string, number> }[]> {
  const currentTuesday = getCurrentTuesday();
  const oldestTuesday = new Date(currentTuesday);
  oldestTuesday.setDate(oldestTuesday.getDate() - (weeks - 1) * 7);

  const q = query(
    collection(db, "posts"),
    where("userId", "==", uid),
    where("status", "==", "active"),
    where("createdAt", ">=", Timestamp.fromDate(oldestTuesday)),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);

  const result: { weekStart: Date; count: number; uniqueDays: number; modes: Record<string, number> }[] = [];
  for (let i = 0; i < weeks; i++) {
    const ws = new Date(currentTuesday);
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const weekPosts = snap.docs.filter((d) => {
      const ca = d.data().createdAt;
      if (!ca?.toDate) return false;
      const t = ca.toDate();
      return t >= ws && t < we;
    });
    const daySet = new Set(weekPosts.map((d) => d.data().createdAt.toDate().toISOString().slice(0, 10)));
    const modes: Record<string, number> = {};
    weekPosts.forEach((d) => {
      const mode = d.data().mode || "chill";
      modes[mode] = (modes[mode] || 0) + 1;
    });
    result.unshift({ weekStart: ws, count: weekPosts.length, uniqueDays: daySet.size, modes });
  }
  return result;
}

/** Get weekly unique posting days for XP calculation (Tuesday reset) */
export async function getWeeklyPostCount(uid: string): Promise<number> {
  const tuesdayStart = getCurrentTuesday();

  const q = query(
    collection(db, "posts"),
    where("userId", "==", uid),
    where("status", "==", "active"),
    orderBy("createdAt", "desc"),
    limit(10)
  );
  const snap = await getDocs(q);
  const daysSet = new Set<string>();
  snap.docs.forEach((d) => {
    const ca = d.data().createdAt;
    if (ca?.toDate && ca.toDate() >= tuesdayStart) {
      daysSet.add(ca.toDate().toISOString().slice(0, 10));
    }
  });
  return daysSet.size;
}

/** Get today's post count for a user */
export async function getDailyPostCount(uid: string): Promise<number> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const q = query(
    collection(db, "posts"),
    where("userId", "==", uid),
    where("createdAt", ">=", Timestamp.fromDate(todayStart)),
    orderBy("createdAt", "desc"),
    limit(10)
  );
  const snap = await getDocs(q);
  return snap.size;
}

interface CreatePostInput {
  userId: string;
  mode: string;
  content: string;
  phase: string;
  dayNumber: number;
  visibility: "public" | "private";
  imageBlob: Blob | null;
  tags?: string[];
  region?: string;
}

export async function createPost(input: CreatePostInput): Promise<string> {
  const editDeadline = new Date(Date.now() + POST_EDIT_WINDOW_MS);

  const postRef = await addDoc(collection(db, "posts"), {
    userId: input.userId,
    mode: input.mode,
    imageUrl: "",
    content: input.content,
    phase: input.phase,
    dayNumber: input.dayNumber,
    likeCount: 0,
    visibility: input.visibility,
    status: "active",
    reportCount: 0,
    tags: input.tags || [],
    region: input.region || "",
    createdAt: serverTimestamp(),
    editableUntil: Timestamp.fromDate(editDeadline),
  });

  if (input.imageBlob) {
    const imageRef = ref(storage, `posts/${input.userId}/${postRef.id}.jpg`);
    await uploadBytes(imageRef, input.imageBlob, { contentType: "image/jpeg" });
    const url = await getDownloadURL(imageRef);
    await updateDoc(postRef, { imageUrl: url });
  }

  return postRef.id;
}

export async function isFirstPost(uid: string): Promise<boolean> {
  const q = query(collection(db, "posts"), where("userId", "==", uid), where("status", "==", "active"), limit(1));
  const snap = await getDocs(q);
  return snap.empty;
}

/** Check if user already has an active post today (local time) */
export async function hasPostedToday(uid: string): Promise<boolean> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const q = query(
    collection(db, "posts"),
    where("userId", "==", uid),
    where("status", "==", "active"),
    orderBy("createdAt", "desc"),
    limit(5)
  );
  const snap = await getDocs(q);
  return snap.docs.some((d) => {
    const ca = d.data().createdAt;
    return ca?.toDate && ca.toDate() >= todayStart;
  });
}

export async function deletePost(postId: string): Promise<void> {
  await deleteDoc(doc(db, "posts", postId));
}

export async function updateUserXPAndStreak(
  uid: string,
  xpGain: number,
  newStreak: number
): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    totalXP: increment(xpGain),
    currentStreak: newStreak,
    lastPostAt: new Date().toISOString(),
  });
}

// ─── Moderation ───

const REPORT_THRESHOLD = 3;

/**
 * Report a post. Each user can only report once per post.
 * When reports reach threshold, auto-hides the post.
 */
export async function reportPost(
  postId: string,
  reporterId: string,
  reason: string
): Promise<"reported" | "already_reported"> {
  const reportRef = doc(db, "posts", postId, "reports", reporterId);

  // Check if already reported
  try {
    const existing = await getDoc(reportRef);
    if (existing.exists()) return "already_reported";
  } catch {
    // If read fails (permissions), try to create anyway — will fail if duplicate
  }

  // Write report to subcollection (triggers checkReportThreshold Cloud Function)
  await setDoc(reportRef, {
    reason,
    createdAt: serverTimestamp(),
  });

  // Increment reportCount on the post
  const postRef = doc(db, "posts", postId);
  await updateDoc(postRef, {
    reportCount: increment(1),
  });

  return "reported";
}

/**
 * Client-side banned words check (pre-submission filter).
 * Fetches list from Firestore moderation_config or uses defaults.
 */
const CLIENT_BANNED_WORDS = [
  // English
  "fuck", "shit", "bitch", "asshole", "nigger", "faggot", "cunt", "whore",
  "retard", "kill yourself", "kys", "die",
  // Japanese
  "死ね", "殺す", "ゴミ", "クソ", "馬鹿",
  // Spam patterns
  "buy now", "click here", "free money", "earn cash",
];

let cachedBannedWords: string[] | null = null;

export async function getBannedWords(): Promise<string[]> {
  if (cachedBannedWords) return cachedBannedWords;
  try {
    const snap = await getDoc(doc(db, "moderation_config", "main"));
    if (snap.exists() && Array.isArray(snap.data().bannedWords)) {
      cachedBannedWords = snap.data().bannedWords as string[];
      return cachedBannedWords;
    }
  } catch {
    // Firestore fetch failed — use client-side defaults
  }
  cachedBannedWords = CLIENT_BANNED_WORDS;
  return cachedBannedWords;
}

export function containsBannedWord(text: string, bannedWords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const word of bannedWords) {
    if (lower.includes(word.toLowerCase())) return word;
  }
  return null;
}
