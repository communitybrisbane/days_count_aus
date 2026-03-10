import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";

/** Check if a nickname is already taken by another user */
export async function isNicknameTaken(nickname: string, excludeUid?: string): Promise<boolean> {
  const q = query(
    collection(db, "users"),
    where("displayName", "==", nickname)
  );
  const snap = await getDocs(q);
  if (snap.empty) return false;
  if (excludeUid) {
    return snap.docs.some((d) => d.id !== excludeUid);
  }
  return true;
}

/** Check if a group name is already taken */
export async function isGroupNameTaken(groupName: string): Promise<boolean> {
  const q = query(
    collection(db, "groups"),
    where("groupName", "==", groupName),
    where("isClosed", "==", false)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
