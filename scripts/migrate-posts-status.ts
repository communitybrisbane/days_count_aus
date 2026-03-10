/**
 * 既存投稿に status: "active" と reportCount: 0 を追加するマイグレーションスクリプト
 *
 * 実行方法:
 *   npx tsx scripts/migrate-posts-status.ts
 */

import * as admin from "firebase-admin";
import { readFileSync } from "fs";

const sa = JSON.parse(readFileSync("C:/Users/panna/sa-key.json", "utf-8"));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function migrate() {
  const snap = await db.collection("posts").get();
  let updated = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const updates: Record<string, unknown> = {};

    if (!data.status) {
      updates.status = "active";
    }
    if (data.reportCount === undefined || data.reportCount === null) {
      updates.reportCount = 0;
    }

    if (Object.keys(updates).length > 0) {
      await db.collection("posts").doc(d.id).update(updates);
      updated++;
      console.log(`  Updated: ${d.id}`);
    }
  }

  console.log(`\nDone! ${updated}/${snap.docs.length} posts updated.`);
  process.exit(0);
}

migrate().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
