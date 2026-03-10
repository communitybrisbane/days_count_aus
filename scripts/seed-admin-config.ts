/**
 * admin_config/main ドキュメントの初期データをFirestoreに書き込むスクリプト
 *
 * 実行方法:
 *   npx tsx scripts/seed-admin-config.ts
 *
 * 注意: 一度だけ実行すればOK。以降はFirebase Consoleから直接編集できます。
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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

async function seed() {
  await setDoc(doc(db, "admin_config", "main"), {
    message: "今週もMake Days Count！",
    zoomUrl: "https://zoom.us/j/xxxxx",
    ai_prompt_template:
      "以下のワーホリ活動ログを分析して、来週のアドバイスをください。",
  });

  console.log("✅ admin_config/main ドキュメントを作成しました！");
  console.log("→ Firebase Console で内容を確認・編集できます。");
  process.exit(0);
}

seed().catch((e) => {
  console.error("❌ エラー:", e);
  process.exit(1);
});
