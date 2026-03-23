/**
 * モードごとの公式グループをFirestoreに作成するスクリプト
 * + 旧モードの公式グループを自動クローズ
 *
 * 実行方法:
 *   npx tsx scripts/seed-official-groups.ts
 *
 * 注意: 何度実行しても安全（既存チェックあり）
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import path from "path";

const serviceAccountPath = path.resolve(__dirname, "../days-count-aus-firebase-adminsdk-fbsvc-9f617868ff.json");

initializeApp({
  credential: cert(serviceAccountPath),
});

const db = getFirestore();

// 新モードの公式グループ
const NEW_OFFICIAL_GROUPS = [
  { mode: "english", groupName: "English Learners" },
  { mode: "skill", groupName: "Skill Builders" },
  { mode: "adventure", groupName: "Challenge Seekers" },
  { mode: "work", groupName: "Workers Hub" },
  { mode: "chill", groupName: "Chill Vibes" },
];

// 旧モードID（クローズ対象）
const LEGACY_MODES = ["enjoying", "challenging", "skills", "social-media", "challenge"];

async function closeLegacyGroups() {
  console.log("\n--- 旧公式グループのクローズ ---");
  for (const mode of LEGACY_MODES) {
    const snap = await db
      .collection("groups")
      .where("mode", "==", mode)
      .where("isOfficial", "==", true)
      .where("isClosed", "==", false)
      .get();

    if (snap.empty) {
      console.log(`⏭ ${mode} — 公式グループなし（スキップ）`);
      continue;
    }
    for (const doc of snap.docs) {
      await doc.ref.update({ isClosed: true });
      console.log(`🔒 ${doc.data().groupName} (${mode}) — クローズ完了`);
    }
  }
}

async function seedNewGroups() {
  console.log("\n--- 新公式グループの作成 ---");
  for (const g of NEW_OFFICIAL_GROUPS) {
    const snap = await db
      .collection("groups")
      .where("mode", "==", g.mode)
      .where("isOfficial", "==", true)
      .where("isClosed", "==", false)
      .get();

    if (!snap.empty) {
      console.log(`⏭ ${g.groupName} (${g.mode}) — 既に存在`);
      continue;
    }

    await db.collection("groups").add({
      mode: g.mode,
      groupName: g.groupName,
      creatorId: "SYSTEM",
      memberIds: [],
      memberCount: 0,
      lastMessageAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      isClosed: false,
      isOfficial: true,
    });
    console.log(`✅ ${g.groupName} (${g.mode}) — 作成完了`);
  }
}

async function main() {
  await closeLegacyGroups();
  await seedNewGroups();
  console.log("\n🎉 完了！旧グループをクローズし、新グループを作成しました。");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ エラー:", e);
  process.exit(1);
});
