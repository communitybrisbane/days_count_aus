import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as nodemailer from "nodemailer";

const gmailUser = defineSecret("GMAIL_USER");
const gmailPass = defineSecret("GMAIL_PASS");
const adminEmail = defineSecret("ADMIN_EMAIL");

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
        `[MODERATION] Hiding post ${postId}: matchCount=${matched.length}, toxicity=${toxicityScore}`
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

// ─── Email helper ───
async function sendReportEmail(subject: string, body: string) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser.value(),
      pass: gmailPass.value(),
    },
  });

  await transporter.sendMail({
    from: `"Days Count" <${gmailUser.value()}>`,
    to: adminEmail.value(),
    subject,
    text: body,
  });
}

// ─── Cloud Function: Auto-hide posts with high report count ───
export const checkReportThreshold = onDocumentCreated(
  {
    document: "posts/{postId}/reports/{reporterId}",
    secrets: [gmailUser, gmailPass, adminEmail],
  },
  async (event) => {
    const postId = event.params.postId;
    const reporterId = event.params.reporterId;
    const reportData = event.data?.data();

    const postRef = db.doc(`posts/${postId}`);
    const postSnap = await postRef.get();

    if (!postSnap.exists) {
      console.log("[REPORT] Post not found:", postId);
      return;
    }
    const data = postSnap.data()!;

    // Count reports
    const reportsSnap = await db.collection(`posts/${postId}/reports`).count().get();
    const reportCount = reportsSnap.data().count;

    // Send email notification only on 1st report and when threshold (3) is reached
    if (reportCount === 1 || reportCount === 3) {
      try {
        const reporterSnap = await db.doc(`users/${reporterId}`).get();
        const reporterName = reporterSnap.exists ? (reporterSnap.data()!.displayName || reporterId) : reporterId;

        await sendReportEmail(
          reportCount >= 3
            ? `[Report] Post AUTO-HIDDEN (${reportCount} reports)`
            : `[Report] Post reported (1st report)`,
          `Post ID: ${postId}\n` +
          `Reporter: ${reporterName}\n` +
          `Reason: ${reportData?.reason || "N/A"}\n` +
          `Report count: ${reportCount}/3\n` +
          `Post content: ${(data.content || "").slice(0, 200)}\n` +
          `Post author: ${data.userId}\n` +
          `${reportCount >= 3 ? ">>> AUTO-HIDDEN <<<" : ""}`
        );
      } catch (e) {
        console.error("[REPORT_EMAIL] Failed to send:", e);
      }
    }

    // Already restricted
    if (data.status === "hidden" || data.reportRestricted === true) return;

    // Auto-restrict at 3 reports: switch to private so only the author can see it
    if (reportCount >= 3) {
      console.log(`[MODERATION] Auto-restricting post ${postId}: ${reportCount} reports → private`);

      await postRef.update({
        visibility: "private",
        reportRestricted: true,
        reportCount,
      });

      await db.collection("moderation_logs").add({
        postId,
        userId: data.userId,
        action: "report_restricted",
        reason: `${reportCount} user reports — switched to private`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);

// ─── Cloud Function: Like notification ───
// In-memory cooldown to prevent notification flooding (per Cloud Function instance)
const likeNotifCooldown = new Map<string, number>();
const LIKE_NOTIF_COOLDOWN_MS = 60_000; // 1 min cooldown per author

export const onLikeCreated = onDocumentCreated(
  "posts/{postId}/likes/{likerId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const { postId, likerId } = event.params;

    // Get post to find author
    const postSnap = await db.doc(`posts/${postId}`).get();
    if (!postSnap.exists) return;
    const postData = postSnap.data()!;
    const authorId = postData.userId as string;

    // Don't notify if user liked their own post
    if (authorId === likerId) return;

    // Rate-limit notifications per author (prevent rapid like spam from multiple users)
    const now = Date.now();
    const lastNotif = likeNotifCooldown.get(authorId) || 0;
    if (now - lastNotif < LIKE_NOTIF_COOLDOWN_MS) return;
    likeNotifCooldown.set(authorId, now);
    setTimeout(() => likeNotifCooldown.delete(authorId), LIKE_NOTIF_COOLDOWN_MS);

    // Get liker's display name
    const likerSnap = await db.doc(`users/${likerId}`).get();
    const likerName = likerSnap.exists ? (likerSnap.data()!.displayName || "Someone") : "Someone";

    // Get author's FCM token and notification prefs
    const privSnap = await db.doc(`users/${authorId}/private/config`).get();
    const privData = privSnap.exists ? privSnap.data() : null;
    const fcmToken = privData?.fcmToken || "";

    if (!fcmToken) return;

    try {
      await admin.messaging().send({
        token: fcmToken,
        data: {
          type: "like",
          title: `🦘 ${likerName} 🦘`,
          body: "liked your post!",
          link: "/mypage",
        },
      });
    } catch (e) {
      console.error(`FCM like notification failed for ${authorId}:`, e);
      // Clear invalid token
      await db.doc(`users/${authorId}/private/config`).update({ fcmToken: "" });
    }
  }
);

// Helper: send streak warning FCM to a user (returns true if sent)
async function sendStreakWarning(
  userDoc: admin.firestore.QueryDocumentSnapshot,
  title: string,
  body: string,
): Promise<boolean> {
  const privSnap = await db.doc(`users/${userDoc.id}/private/config`).get();
  const privData = privSnap.exists ? privSnap.data() : null;
  const fcmToken = privData?.fcmToken || "";
  if (!fcmToken) return false;
  try {
    await admin.messaging().send({
      token: fcmToken,
      data: { type: "streak", title, body, link: "/post" },
    });
    return true;
  } catch (e) {
    console.error(`FCM send failed for ${userDoc.id}:`, e);
    await db.doc(`users/${userDoc.id}/private/config`).update({ fcmToken: "" });
    return false;
  }
}

// ─── Scheduled: Streak warning & reset (UTC calendar-date based) ───
// Matches client logic: streak continues only if lastPostAt date === yesterday (UTC).
// Reset: lastPostAt date < yesterday → streak = 0
// Warning 1: UTC 20:00+ (4h before midnight) — first nudge
// Warning 2: UTC 23:00+ (1h before midnight) — final urgent
export const checkStreaks = onSchedule(
  { schedule: "every 1 hours", timeZone: "Australia/Sydney" },
  async () => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const utcHour = now.getUTCHours();

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

      const lastPostDateStr = new Date(data.lastPostAt).toISOString().slice(0, 10);

      if (lastPostDateStr === todayStr) {
        // Posted today — streak is safe, nothing to do
        continue;
      }

      if (lastPostDateStr < yesterdayStr) {
        // Last post is 2+ days ago — reset streak
        await userDoc.ref.update({ currentStreak: 0, streakWarningSent: 0 });
        reset++;
      } else if (lastPostDateStr === yesterdayStr) {
        // Posted yesterday but not today — check if we need to warn
        const warnLevel = data.streakWarningSent || 0;

        // Final warning: UTC 23:00+ (1h left)
        if (utcHour >= 23 && warnLevel < 2) {
          const sent = await sendStreakWarning(userDoc, "🦘 Hey, only 1 hour left!? 🦘", "Please… I'm about to cry 🥺");
          if (sent) {
            await userDoc.ref.update({ streakWarningSent: 2 });
            warned++;
          }
        // First warning: UTC 20:00+ (4h left)
        } else if (utcHour >= 20 && warnLevel < 1) {
          const sent = await sendStreakWarning(userDoc, "🦘 No post today…? 🦘", "I'm lonely… post something! 🥹");
          if (sent) {
            await userDoc.ref.update({ streakWarningSent: 1 });
            warned++;
          }
        }
      }
    }

    // Reset streakWarningSent for users who posted today
    const recentSnap = await db
      .collection("users")
      .where("streakWarningSent", ">", 0)
      .get();
    for (const userDoc of recentSnap.docs) {
      const data = userDoc.data();
      if (!data.lastPostAt) continue;
      const lastPostDateStr = new Date(data.lastPostAt).toISOString().slice(0, 10);
      if (lastPostDateStr === todayStr) {
        await userDoc.ref.update({ streakWarningSent: 0 });
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

// ─── Cloud Function: Group message notification ───
// Per-group notification cooldown to prevent message spam flooding
const groupNotifCooldown = new Map<string, number>();
const GROUP_NOTIF_COOLDOWN_MS = 10_000; // 10 sec cooldown per group

export const onGroupMessageCreated = onDocumentCreated(
  "groups/{groupId}/messages/{messageId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const { groupId } = event.params;
    const msgData = snap.data();
    const senderId = msgData.senderId as string;
    const text = (msgData.text as string) || "";

    // Rate-limit notifications per group (prevent rapid message spam)
    const now = Date.now();
    const lastNotif = groupNotifCooldown.get(groupId) || 0;
    if (now - lastNotif < GROUP_NOTIF_COOLDOWN_MS) return;
    groupNotifCooldown.set(groupId, now);
    setTimeout(() => groupNotifCooldown.delete(groupId), GROUP_NOTIF_COOLDOWN_MS);

    // Get group info
    const groupSnap = await db.doc(`groups/${groupId}`).get();
    if (!groupSnap.exists) return;
    const groupData = groupSnap.data()!;
    const groupName = (groupData.groupName as string) || "Group";
    const groupIcon = (groupData.iconUrl as string) || "";
    const memberIds: string[] = groupData.memberIds || [];

    // Get sender's display name
    const senderSnap = await db.doc(`users/${senderId}`).get();
    const senderName = senderSnap.exists ? (senderSnap.data()!.displayName || "Someone") : "Someone";

    // Send to all members except sender
    const recipients = memberIds.filter((uid) => uid !== senderId);
    if (recipients.length === 0) return;

    // Read FCM tokens and mute preferences in parallel
    const [privSnaps, lastReadSnaps] = await Promise.all([
      Promise.all(recipients.map((uid) => db.doc(`users/${uid}/private/config`).get())),
      Promise.all(recipients.map((uid) => db.doc(`groups/${groupId}/lastRead/${uid}`).get())),
    ]);

    const messages: admin.messaging.TokenMessage[] = [];
    const invalidTokenUsers: string[] = [];

    for (let i = 0; i < recipients.length; i++) {
      // Skip muted users
      const lastReadData = lastReadSnaps[i].exists ? lastReadSnaps[i].data() : null;
      if (lastReadData?.muted) continue;

      const privData = privSnaps[i].exists ? privSnaps[i].data() : null;
      const fcmToken = privData?.fcmToken || "";
      if (!fcmToken) continue;

      const msgPreview = text.length > 80 ? text.slice(0, 80) + "…" : text;
      messages.push({
        token: fcmToken,
        data: {
          type: "group_message",
          title: groupName,
          body: `${senderName}: ${msgPreview}`,
          link: `/groups/${groupId}`,
          icon: groupIcon,
          senderName,
        },
      });
    }

    if (messages.length === 0) return;

    // Send all notifications
    const results = await admin.messaging().sendEach(messages);

    // Clear invalid tokens
    results.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
        // Find which user this was for
        const tokenToFind = messages[idx].token;
        for (let i = 0; i < recipients.length; i++) {
          const privData = privSnaps[i].exists ? privSnaps[i].data() : null;
          if (privData?.fcmToken === tokenToFind) {
            invalidTokenUsers.push(recipients[i]);
            break;
          }
        }
      }
    });

    for (const uid of invalidTokenUsers) {
      await db.doc(`users/${uid}/private/config`).update({ fcmToken: "" });
    }

    console.log(`[GROUP_MSG] Sent ${results.successCount}/${messages.length} notifications for group ${groupId}`);
  }
);

// ─── Cloud Function: Sync groupIds when members are removed (kick/leave) ───
export const syncGroupMembership = onDocumentUpdated(
  "groups/{groupId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const groupId = event.params.groupId;
    const oldMembers: string[] = before.memberIds || [];
    const newMembers: string[] = after.memberIds || [];

    // Find removed members
    const removedMembers = oldMembers.filter((uid) => !newMembers.includes(uid));

    for (const uid of removedMembers) {
      try {
        await db.doc(`users/${uid}`).update({
          groupIds: admin.firestore.FieldValue.arrayRemove(groupId),
        });
        console.log(`[GROUP_SYNC] Removed groupId ${groupId} from user ${uid}`);
      } catch (e) {
        console.error(`[GROUP_SYNC] Failed to update user ${uid}:`, e);
      }
    }
  }
);
