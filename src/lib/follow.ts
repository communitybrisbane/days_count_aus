import {
  collection,
  doc,
  setDoc,
  deleteDoc,
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

/** Get UIDs the user is following (max 200) */
export async function getFollowingIds(uid: string): Promise<string[]> {
  const q = query(collection(db, "users", uid, "following"), limit(200));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.id);
}
