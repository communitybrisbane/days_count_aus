/**
 * moderation_config/main ドキュメントの初期データをFirestoreに書き込むスクリプト
 *
 * 実行方法:
 *   npx tsx scripts/seed-moderation-config.ts
 */

import * as admin from "firebase-admin";
import { readFileSync } from "fs";

const sa = JSON.parse(readFileSync("C:/Users/panna/sa-key.json", "utf-8"));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function seed() {
  await db.collection("moderation_config").doc("main").set({
    bannedWords: [
      "fuck", "shit", "ass", "bitch", "dick", "bastard",
      "damn", "crap", "nigger", "faggot", "retard",
      "kill", "die", "suicide",
    ],
  });

  console.log("Done! moderation_config/main created.");
  console.log("You can edit the banned words list in Firebase Console.");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
