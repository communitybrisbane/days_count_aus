import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/** Follow a user */
export async function followUser(myUid: string, targetUid: string) {
  await setDoc(doc(db, "users", myUid, "following", targetUid), {
    createdAt: serverTimestamp(),
  });
}

/** Unfollow a user */
export async function unfollowUser(myUid: string, targetUid: string) {
  await deleteDoc(doc(db, "users", myUid, "following", targetUid));
}

/** Get UIDs the user is following (max 200), auto-clean deleted users */
export async function getFollowingIds(uid: string): Promise<string[]> {
  const q = query(collection(db, "users", uid, "following"), limit(200));
  const snap = await getDocs(q);
  const ids = snap.docs.map((d) => d.id);

  // Check which users still exist and clean up deleted ones
  const checks = await Promise.all(ids.map((id) => getDoc(doc(db, "users", id))));
  const validIds: string[] = [];
  const cleanupPromises: Promise<void>[] = [];
  checks.forEach((userSnap, i) => {
    if (userSnap.exists()) {
      validIds.push(ids[i]);
    } else {
      cleanupPromises.push(deleteDoc(doc(db, "users", uid, "following", ids[i])));
    }
  });
  if (cleanupPromises.length > 0) {
    await Promise.all(cleanupPromises).catch(() => {});
  }
  return validIds;
}
