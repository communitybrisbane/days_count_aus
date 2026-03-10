/**
 * モードごとの公式グループをFirestoreに作成するスクリプト
 *
 * 実行方法:
 *   npx tsx scripts/seed-official-groups.ts
 *
 * 注意: 一度だけ実行すればOK。グループ名はFirebase Consoleから変更可能。
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCRZqyROJXSAYct8qDPTw2tyO9D7bfP2lQ",
  authDomain: "days-count-aus.firebaseapp.com",
  projectId: "days-count-aus",
  storageBucket: "days-count-aus.firebasestorage.app",
  messagingSenderId: "457409155401",
  appId: "1:457409155401:web:b1281bb1e98e9944130a98",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const OFFICIAL_GROUPS = [
  { mode: "english", groupName: "English Learners" },
  { mode: "social-media", groupName: "SNS Creators" },
  { mode: "skills", groupName: "Skill Builders" },
  { mode: "enjoying", groupName: "Aussie Explorers" },
  { mode: "challenging", groupName: "Challenge Seekers" },
];

async function seed() {
  for (const g of OFFICIAL_GROUPS) {
    // 既存チェック
    const q = query(
      collection(db, "groups"),
      where("mode", "==", g.mode),
      where("isOfficial", "==", true),
      where("isClosed", "==", false)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      console.log(`⏭ ${g.groupName} (${g.mode}) — 既に存在`);
      continue;
    }

    await addDoc(collection(db, "groups"), {
      mode: g.mode,
      groupName: g.groupName,
      creatorId: "SYSTEM",
      memberIds: [],
      memberCount: 0,
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      isClosed: false,
      isOfficial: true,
    });
    console.log(`✅ ${g.groupName} (${g.mode}) — 作成完了`);
  }

  console.log("\n🎉 公式グループの作成が完了しました！");
  console.log("→ Firebase Console でグループ名を変更できます。");
  process.exit(0);
}

seed().catch((e) => {
  console.error("❌ エラー:", e);
  process.exit(1);
});
