/**
 * legal_docs コレクションに Terms / Privacy / Legal Notice の全文をアップロード
 * LegalModals.tsx のフォールバックと同じ内容をFirestoreに保存する
 *
 * 実行方法:
 *   npx tsx scripts/seed-legal-docs.ts
 */

import * as admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const sa = JSON.parse(readFileSync(new URL("../days-count-aus-firebase-adminsdk-fbsvc-bd0cbb4f49.json", import.meta.url), "utf-8"));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// Read LegalModals.tsx and extract content between backtick strings
const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dirname, "../src/components/LegalModals.tsx"), "utf-8");

function extractConst(name: string): string {
  const regex = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`);
  const match = src.match(regex);
  return match ? match[1].trim() : "";
}

async function seed() {
  const docs = [
    {
      id: "terms",
      contentJa: extractConst("TERMS_JA"),
      contentEn: extractConst("TERMS_EN"),
    },
    {
      id: "privacy",
      contentJa: extractConst("PRIVACY_JA"),
      contentEn: extractConst("PRIVACY_EN"),
    },
    {
      id: "legal_notice",
      contentJa: extractConst("LEGAL_NOTICE_JA"),
      contentEn: extractConst("LEGAL_NOTICE_EN"),
    },
  ];

  for (const d of docs) {
    if (!d.contentJa) {
      console.log(`  ✗ ${d.id} — JA content not found, skipping`);
      continue;
    }
    await db.collection("legal_docs").doc(d.id).set({
      contentJa: d.contentJa,
      contentEn: d.contentEn,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`  ✓ legal_docs/${d.id} (JA: ${d.contentJa.length} chars, EN: ${d.contentEn.length} chars)`);
  }

  console.log("\nDone.");
}

seed().catch(console.error);
