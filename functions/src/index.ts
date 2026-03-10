import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();
const db = admin.firestore();

// ─── Banned words list (fallback; can be overridden from Firestore moderation_config/main) ───
const DEFAULT_BANNED_WORDS = [
  // English
  "fuck", "shit", "bitch", "asshole", "nigger", "faggot", "cunt", "whore",
  "retard", "kill yourself", "kys", "die",
  // Japanese
  "死ね", "殺す", "ゴミ", "クソ", "馬鹿",
  // Spam patterns
  "buy now", "click here", "free money", "earn cash",
];

/**
 * Fetch banned words from Firestore (allows admin to update via console)
 * Falls back to default list if not configured
 */
async function getBannedWords(): Promise<string[]> {
  try {
    const snap = await db.doc("moderation_config/main").get();
    if (snap.exists) {
      const data = snap.data();
      if (data?.bannedWords && Array.isArray(data.bannedWords)) {
        return data.bannedWords as string[];
      }
    }
  } catch (e) {
    console.error("Failed to fetch moderation config:", e);
  }
  return DEFAULT_BANNED_WORDS;
}

/**
 * Check text against banned words list
 * Returns matched words or empty array
 */
function checkBannedWords(text: string, bannedWords: string[]): string[] {
  const lower = text.toLowerCase();
  return bannedWords.filter((word) => lower.includes(word.toLowerCase()));
}

/**
 * Simple toxicity heuristic: excessive caps, repeated chars, slur patterns
 * Returns a score 0-1
 */
function calculateToxicityScore(text: string): number {
  let score = 0;

  // Excessive caps (>60% uppercase in text longer than 5 chars)
  if (text.length > 5) {
    const upperRatio = (text.match(/[A-Z]/g)?.length || 0) / text.length;
    if (upperRatio > 0.6) score += 0.2;
  }

  // Repeated characters (e.g., "fuuuuck")
  if (/(.)\1{4,}/i.test(text)) score += 0.15;

  // Excessive exclamation/question marks
  if ((text.match(/[!?]{3,}/g)?.length || 0) > 0) score += 0.1;

  return Math.min(score, 1);
}

// ─── Cloud Function: Auto-moderate new posts ───
export const moderatePost = onDocumentCreated(
  "posts/{postId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const content: string = data.content || "";
    const postId = event.params.postId;

    // Skip if already hidden
    if (data.status === "hidden") return;

    const bannedWords = await getBannedWords();
    const matched = checkBannedWords(content, bannedWords);
    const toxicityScore = calculateToxicityScore(content);

    const shouldHide = matched.length > 0 || toxicityScore >= 0.5;

    if (shouldHide) {
      console.log(
        `[MODERATION] Hiding post ${postId}: matched=${JSON.stringify(matched)}, toxicity=${toxicityScore}`
      );

      await db.doc(`posts/${postId}`).update({ status: "hidden" });

      // Log moderation action
      await db.collection("moderation_logs").add({
        postId,
        userId: data.userId,
        action: "auto_hidden",
        reason: matched.length > 0 ? `Banned words: ${matched.join(", ")}` : `Toxicity score: ${toxicityScore}`,
        content: content.slice(0, 200),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);

// ─── Cloud Function: Auto-hide posts with high report count ───
export const checkReportThreshold = onDocumentCreated(
  "posts/{postId}/reports/{reporterId}",
  async (event) => {
    const postId = event.params.postId;

    const postRef = db.doc(`posts/${postId}`);
    const postSnap = await postRef.get();

    if (!postSnap.exists) return;
    const data = postSnap.data()!;

    // Already hidden
    if (data.status === "hidden") return;

    // Count reports
    const reportsSnap = await db.collection(`posts/${postId}/reports`).count().get();
    const reportCount = reportsSnap.data().count;

    // Auto-hide at 3 reports
    if (reportCount >= 3) {
      console.log(`[MODERATION] Auto-hiding post ${postId}: ${reportCount} reports`);

      await postRef.update({
        status: "hidden",
        reportCount,
      });

      await db.collection("moderation_logs").add({
        postId,
        userId: data.userId,
        action: "report_hidden",
        reason: `${reportCount} user reports`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);

// ─── Scheduled: Streak warning (6h before 48h expiry) & reset ───
export const checkStreaks = onSchedule(
  { schedule: "every 1 hours", timeZone: "Australia/Sydney" },
  async () => {
    const now = Date.now();
    const FORTY_TWO_HOURS = 42 * 60 * 60 * 1000;
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

    // Get users with active streaks
    const usersSnap = await db
      .collection("users")
      .where("currentStreak", ">", 0)
      .get();

    let warned = 0;
    let reset = 0;

    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      if (!data.lastPostAt) continue;

      const lastPostTime = new Date(data.lastPostAt).getTime();
      const elapsed = now - lastPostTime;

      if (elapsed >= FORTY_EIGHT_HOURS) {
        // Reset streak
        await userDoc.ref.update({ currentStreak: 0 });
        reset++;
      } else if (
        elapsed >= FORTY_TWO_HOURS &&
        data.fcmToken &&
        !data.streakWarningSent
      ) {
        // Send 6-hour warning
        try {
          await admin.messaging().send({
            token: data.fcmToken,
            notification: {
              title: "Streak warning!",
              body: "Your streak expires in 6 hours. Post now to keep it!",
            },
            webpush: {
              fcmOptions: { link: "/post" },
            },
          });
          await userDoc.ref.update({ streakWarningSent: true });
          warned++;
        } catch (e) {
          // Token might be invalid — clear it
          console.error(`FCM send failed for ${userDoc.id}:`, e);
          await userDoc.ref.update({ fcmToken: "" });
        }
      }
    }

    // Reset streakWarningSent flag for users who posted recently
    const recentSnap = await db
      .collection("users")
      .where("streakWarningSent", "==", true)
      .get();
    for (const userDoc of recentSnap.docs) {
      const data = userDoc.data();
      if (!data.lastPostAt) continue;
      const elapsed = now - new Date(data.lastPostAt).getTime();
      if (elapsed < FORTY_TWO_HOURS) {
        await userDoc.ref.update({ streakWarningSent: false });
      }
    }

    console.log(`[STREAK] Warned: ${warned}, Reset: ${reset}`);
  }
);

// ─── Scheduled: Daily cleanup of old hidden posts (optional) ───
export const cleanupHiddenPosts = onSchedule(
  { schedule: "every day 03:00", timeZone: "Australia/Sydney" },
  async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const snap = await db
      .collection("posts")
      .where("status", "==", "hidden")
      .where("createdAt", "<", admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
      .limit(100)
      .get();

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[CLEANUP] Deleted ${snap.size} old hidden posts`);
  }
);
