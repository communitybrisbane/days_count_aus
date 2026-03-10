import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
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

/** Get all UIDs the user is following */
export async function getFollowingIds(uid: string): Promise<string[]> {
  const snap = await getDocs(collection(db, "users", uid, "following"));
  return snap.docs.map((d) => d.id);
}
