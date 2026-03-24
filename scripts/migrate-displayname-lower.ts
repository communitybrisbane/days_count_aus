/**
 * 既存ユーザーに displayNameLower フィールドを追加するマイグレーションスクリプト
 * displayName の小文字版を保存し、大文字小文字を区別しないユニーク判定・検索を実現する
 *
 * 実行方法:
 *   npx tsx scripts/migrate-displayname-lower.ts
 */

import * as admin from "firebase-admin";
import { readFileSync } from "fs";

const sa = JSON.parse(readFileSync(new URL("../days-count-aus-firebase-adminsdk-fbsvc-bd0cbb4f49.json", import.meta.url), "utf-8"));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function migrate() {
  const snap = await db.collection("users").get();
  let updated = 0;
  let skipped = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const displayName = data.displayName || "";
    const expected = displayName.toLowerCase();

    if (data.displayNameLower === expected) {
      skipped++;
      continue;
    }

    await d.ref.update({ displayNameLower: expected });
    updated++;
    console.log(`  ✓ ${d.id} → "${displayName}" → "${expected}"`);
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped (already set)`);
}

migrate().catch(console.error);
