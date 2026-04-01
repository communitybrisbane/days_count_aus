import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
} from "firebase/firestore";
import { db } from "./firebase";
import { MAX_GROUP_MEMBERS } from "./constants";
import type { Group } from "@/types";

/**
 * Fetch visible groups for a user by their groupIds.
 * Filters out closed groups and official groups without icons.
 */
export async function fetchUserGroups(groupIds: string[]): Promise<Group[]> {
  if (!groupIds.length) return [];
  const groups: Group[] = [];
  await Promise.all(
    groupIds.map(async (gid) => {
      const snap = await getDoc(doc(db, "groups", gid));
      if (snap.exists()) {
        const g = { id: snap.id, ...snap.data() } as Group;
        if (!g.isClosed && (!g.isOfficial || g.iconUrl)) groups.push(g);
      }
    })
  );
  return groups;
}

/**
 * Find the official MODE group doc for a given mode (no icon).
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
  // Only return mode groups (no icon) — skip icon-based official groups
  const modeDoc = snap.docs.find((d) => !d.data().iconUrl);
  if (!modeDoc) return null;
  return { id: modeDoc.id, ...modeDoc.data() } as Group;
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
  await updateDoc(firestoreDoc(db, "users", uid), {
    groupIds: arrayUnion(group.id),
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
  await updateDoc(firestoreDoc(db, "users", uid), {
    groupIds: arrayRemove(group.id),
  });
}
