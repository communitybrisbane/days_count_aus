/**
 * プリセットコミュニティ（公式グループ）をFirestoreに作成 + アイコンをStorageにアップロード
 *
 * 実行方法:
 *   npx tsx scripts/seed-preset-groups.ts
 *
 * 注意: 何度実行しても安全（同名チェックあり）
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as fs from "fs";
import * as path from "path";

const serviceAccountPath = path.resolve(__dirname, "../days-count-aus-firebase-adminsdk-fbsvc-9f617868ff.json");

const app = initializeApp({
  credential: cert(serviceAccountPath),
  storageBucket: "days-count-aus.firebasestorage.app",
});

const db = getFirestore();
const bucket = getStorage().bucket();

const ICON_DIR = path.resolve(__dirname, "group-icons");

const PRESET_GROUPS = [
  // English
  { mode: "english", groupName: "English Conversation", icon: "english-conversation.svg" },
  { mode: "english", groupName: "Vocab & Grammar", icon: "vocab-grammar.svg" },
  { mode: "english", groupName: "TOEIC", icon: "toeic.svg" },
  { mode: "english", groupName: "IELTS", icon: "ielts.svg" },
  // Skill
  { mode: "skill", groupName: "AI", icon: "ai.svg" },
  { mode: "skill", groupName: "SNS", icon: "sns.svg" },
  { mode: "skill", groupName: "Japanese Teacher", icon: "japanese-teacher.svg" },
  { mode: "skill", groupName: "Video Editing", icon: "video-editing.svg" },
  { mode: "skill", groupName: "HP Creation", icon: "hp-creation.svg" },
  { mode: "skill", groupName: "App Development", icon: "app-development.svg" },
  // Challenge (adventure)
  { mode: "adventure", groupName: "Street Interview", icon: "street-interview.svg" },
  { mode: "adventure", groupName: "Road Trip", icon: "road-trip.svg" },
  { mode: "adventure", groupName: "Community Builder", icon: "community-builder.svg" },
  { mode: "adventure", groupName: "Japanese Event", icon: "japanese-event.svg" },
  // Work
  { mode: "work", groupName: "Farm", icon: "farm.svg" },
  { mode: "work", groupName: "Factory", icon: "factory.svg" },
  { mode: "work", groupName: "City Job", icon: "city-job.svg" },
  { mode: "work", groupName: "Overtime Grinder", icon: "overtime-grinder.svg" },
  // Chill
  { mode: "chill", groupName: "Running", icon: "running.svg" },
  { mode: "chill", groupName: "Beach", icon: "beach.svg" },
  { mode: "chill", groupName: "Camping", icon: "camping.svg" },
  { mode: "chill", groupName: "BBQ", icon: "bbq.svg" },
];

async function uploadIcon(groupId: string, iconFileName: string): Promise<string> {
  const localPath = path.join(ICON_DIR, iconFileName);
  const destPath = `groups/${groupId}/icon.svg`;

  await bucket.upload(localPath, {
    destination: destPath,
    metadata: {
      contentType: "image/svg+xml",
      metadata: { firebaseStorageDownloadTokens: groupId },
    },
  });

  const file = bucket.file(destPath);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: "2099-12-31",
  });

  return url;
}

async function main() {
  console.log("--- プリセットコミュニティの作成 ---\n");

  let created = 0;
  let skipped = 0;

  for (const g of PRESET_GROUPS) {
    // Check if already exists by name
    const snap = await db
      .collection("groups")
      .where("groupName", "==", g.groupName)
      .where("isOfficial", "==", true)
      .where("isClosed", "==", false)
      .get();

    if (!snap.empty) {
      console.log(`⏭ ${g.groupName} (${g.mode}) — already exists`);
      skipped++;
      continue;
    }

    // Create group doc
    const groupRef = await db.collection("groups").add({
      mode: g.mode,
      groupName: g.groupName,
      goal: "Be friendly, have fun!",
      creatorId: "SYSTEM",
      memberIds: [],
      memberCount: 0,
      iconUrl: "",
      lastMessageAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      isClosed: false,
      isOfficial: true,
    });

    // Upload icon
    try {
      const iconUrl = await uploadIcon(groupRef.id, g.icon);
      await groupRef.update({ iconUrl });
      console.log(`✅ ${g.groupName} (${g.mode}) — created + icon uploaded`);
    } catch (err) {
      console.log(`✅ ${g.groupName} (${g.mode}) — created (icon upload failed: ${err})`);
    }

    created++;
  }

  console.log(`\n🎉 Done! Created: ${created}, Skipped: ${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
