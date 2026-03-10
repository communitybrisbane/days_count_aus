/**
 * admin_config/main にイベントフィールドを追加するスクリプト
 *
 * 実行方法:
 *   npx tsx scripts/update-admin-config.ts
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc } from "firebase/firestore";

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

async function update() {
  await updateDoc(doc(db, "admin_config", "main"), {
    eventName: "Weekly Zoom Meetup",
    eventDate: "3/15 (Sat) 20:00 JST",
    eventUrl: "https://us05web.zoom.us/j/xxxxx",
  });

  console.log("✅ eventName, eventDate, eventUrl を追加しました！");
  process.exit(0);
}

update().catch((e) => {
  console.error("❌ エラー:", e);
  process.exit(1);
});
