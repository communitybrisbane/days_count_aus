import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Group } from "@/types";

/**
 * Find the official group doc for a given mode.
 * Returns Group or null.
 */
export async function getOfficialGroup(mode: string): Promise<Group | null> {
  const q = query(
    collection(db, "groups"),
    where("mode", "==", mode),
    where("isOfficial", "==", true),
    where("isClosed", "==", false)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Group;
}

/**
 * Join user to the official group of the given mode.
 * Skips if already a member.
 */
export async function joinOfficialGroup(uid: string, mode: string) {
  const group = await getOfficialGroup(mode);
  if (!group) return;
  const memberIds = group.memberIds || [];
  if (memberIds.includes(uid)) return;

  const { doc: firestoreDoc } = await import("firebase/firestore");
  await updateDoc(firestoreDoc(db, "groups", group.id), {
    memberIds: arrayUnion(uid),
    memberCount: increment(1),
  });
}

/**
 * Leave the official group of the given mode.
 */
export async function leaveOfficialGroup(uid: string, mode: string) {
  const group = await getOfficialGroup(mode);
  if (!group) return;
  const memberIds = group.memberIds || [];
  if (!memberIds.includes(uid)) return;

  const { doc: firestoreDoc } = await import("firebase/firestore");
  await updateDoc(firestoreDoc(db, "groups", group.id), {
    memberIds: arrayRemove(uid),
    memberCount: increment(-1),
  });
}
