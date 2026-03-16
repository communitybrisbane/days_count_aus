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

  // Weekly reset: Tuesday 00:00 local time
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, 2=Tue, ...
  const daysSinceTuesday = (day + 5) % 7; // Tue=0, Wed=1, ..., Mon=6
  const tuesdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceTuesday, 0, 0, 0, 0);
  const weeklyPostCount = snap.docs.filter((d) => {
    const ca = d.data().createdAt;
    return ca?.toDate && ca.toDate() >= tuesdayStart;
  }).length;

  return { totalLikes, weeklyPostCount };
}

/** Get weekly post count for XP calculation (Tuesday reset) */
export async function getWeeklyPostCount(uid: string): Promise<number> {
  const now = new Date();
  const day = now.getDay();
  const daysSinceTuesday = (day + 5) % 7;
  const tuesdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceTuesday, 0, 0, 0, 0);

  const q = query(
    collection(db, "posts"),
    where("userId", "==", uid),
    where("status", "==", "active"),
    orderBy("createdAt", "desc"),
    limit(10)
  );
  const snap = await getDocs(q);
  return snap.docs.filter((d) => {
    const ca = d.data().createdAt;
    return ca?.toDate && ca.toDate() >= tuesdayStart;
  }).length;
}

interface CreatePostInput {
  userId: string;
  mode: string;
  content: string;
  phase: string;
  dayNumber: number;
  visibility: "public" | "private";
  imageBlob: Blob | null;
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
    createdAt: serverTimestamp(),
    editableUntil: Timestamp.fromDate(editDeadline),
  });

  if (input.imageBlob) {
    const imageRef = ref(storage, `posts/${input.userId}/${postRef.id}.jpg`);
    await uploadBytes(imageRef, input.imageBlob);
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
): Promise<"reported" | "already_reported" | "auto_hidden"> {
  const reportRef = doc(db, "posts", postId, "reports", reporterId);

  // Check if already reported
  const existing = await getDoc(reportRef);
  if (existing.exists()) return "already_reported";

  // Write report to subcollection
  await setDoc(reportRef, {
    reason,
    createdAt: serverTimestamp(),
  });

  // Increment reportCount on the post
  const postRef = doc(db, "posts", postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) return "reported";

  const currentCount = (postSnap.data().reportCount || 0) + 1;

  if (currentCount >= REPORT_THRESHOLD) {
    // Auto-hide
    await updateDoc(postRef, {
      reportCount: currentCount,
      status: "hidden",
    });
    return "auto_hidden";
  } else {
    await updateDoc(postRef, {
      reportCount: increment(1),
    });
    return "reported";
  }
}

/**
 * Client-side banned words check (pre-submission filter).
 * Fetches list from Firestore moderation_config or uses defaults.
 */
const CLIENT_BANNED_WORDS = [
  "fuck", "shit", "bitch", "asshole", "nigger", "faggot", "cunt", "whore",
  "retard", "kill yourself", "kys",
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
  } catch {}
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
