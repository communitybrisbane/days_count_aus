import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  addDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from "firebase/storage";
import { deleteUser, User } from "firebase/auth";
import { db, storage } from "@/lib/firebase";
import type { UserProfile } from "@/types";

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function updateProfile(
  uid: string,
  data: Partial<Record<string, unknown>>
): Promise<void> {
  await updateDoc(doc(db, "users", uid), data);
}

export async function uploadAvatar(uid: string, blob: Blob): Promise<string> {
  const imgRef = ref(storage, `avatars/${uid}.jpg`);
  await uploadBytes(imgRef, blob);
  const url = await getDownloadURL(imgRef);
  await updateDoc(doc(db, "users", uid), { photoURL: url });
  return url;
}

export async function deleteAccount(user: User): Promise<void> {
  const uid = user.uid;

  // Delete all posts
  const postsQ = query(collection(db, "posts"), where("userId", "==", uid));
  const postsSnap = await getDocs(postsQ);
  const batch = writeBatch(db);
  postsSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  // Delete post images
  try {
    const storageRef = ref(storage, `posts/${uid}`);
    const files = await listAll(storageRef);
    await Promise.all(files.items.map((item) => deleteObject(item)));
  } catch {}

  // Handle groups
  const groupsSnap = await getDocs(collection(db, "groups"));
  for (const groupDoc of groupsSnap.docs) {
    const data = groupDoc.data();
    if (data.creatorId === uid) {
      await updateDoc(groupDoc.ref, { isClosed: true });
    } else if (data.memberIds?.includes(uid)) {
      await updateDoc(groupDoc.ref, {
        memberIds: data.memberIds.filter((id: string) => id !== uid),
        memberCount: (data.memberCount || 1) - 1,
      });
    }
  }

  // Delete user doc & Firebase Auth account
  await deleteDoc(doc(db, "users", uid));
  await deleteUser(user);
}

export async function submitReport(
  reporterId: string,
  targetUserId: string,
  reason: string,
  imageFile: File
): Promise<void> {
  const imgRef = ref(storage, `reports/${reporterId}_${Date.now()}.jpg`);
  await uploadBytes(imgRef, imageFile);
  const imageUrl = await getDownloadURL(imgRef);

  await addDoc(collection(db, "reports"), {
    reporterId,
    targetUserId,
    targetPostId: "",
    reason,
    imageUrl,
    createdAt: serverTimestamp(),
    resolved: false,
  });
}

export async function blockUser(myUid: string, targetUid: string): Promise<void> {
  await updateDoc(doc(db, "users", myUid), { blockedUsers: arrayUnion(targetUid) });
}

export async function unblockUser(myUid: string, targetUid: string): Promise<void> {
  await updateDoc(doc(db, "users", myUid), { blockedUsers: arrayRemove(targetUid) });
}

export async function saveFCMToken(uid: string, token: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), { fcmToken: token });
}

export async function fetchAdminConfig() {
  const snap = await getDoc(doc(db, "admin_config", "main"));
  return snap.exists() ? snap.data() : null;
}
