/**
 * Firestore の banners コレクションにバナーデータを投入するスクリプト
 *
 * 実行方法:
 *   npx tsx scripts/seed-banners.ts
 *
 * Firestore banners ドキュメント構造:
 *   - imageUrl:  string   (画像URL)
 *   - linkUrl:   string   (タップ時の遷移先, 任意)
 *   - location:  string   ("home" | "mypage" | "community")
 *   - order:     number   (表示順)
 *   - active:    boolean  (表示/非表示)
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, deleteDoc } from "firebase/firestore";

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

const banners = [
  // HOME tab
  { imageUrl: "https://placehold.co/960x540/D4A017/white?text=HOME+Ad+1", linkUrl: "", location: "home", order: 1, active: true },
  { imageUrl: "https://placehold.co/960x540/2196F3/white?text=HOME+Ad+2", linkUrl: "", location: "home", order: 2, active: true },
  // MY tab
  { imageUrl: "https://placehold.co/960x540/7B1FA2/white?text=MY+Ad+1", linkUrl: "", location: "mypage", order: 1, active: true },
  { imageUrl: "https://placehold.co/960x540/E91E63/white?text=MY+Ad+2", linkUrl: "", location: "mypage", order: 2, active: true },
  // Community tab
  { imageUrl: "https://placehold.co/960x540/E65100/white?text=COM+Ad+1", linkUrl: "", location: "community", order: 1, active: true },
  { imageUrl: "https://placehold.co/960x540/00897B/white?text=COM+Ad+2", linkUrl: "", location: "community", order: 2, active: true },
];

async function main() {
  // Clear existing banners
  const existing = await getDocs(collection(db, "banners"));
  for (const doc of existing.docs) {
    await deleteDoc(doc.ref);
  }
  console.log(`Cleared ${existing.size} existing banners`);

  // Seed new banners
  for (const banner of banners) {
    const ref = await addDoc(collection(db, "banners"), banner);
    console.log(`Added [${banner.location}] banner: ${ref.id} (order: ${banner.order})`);
  }

  console.log("\nDone! Banners are managed per location in Firestore > banners collection");
}

main().catch(console.error);
