import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  collectionGroup,
  query,
  where,
  limit,
  getDocs,
  writeBatch,
  addDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from "firebase/storage";
import {
  deleteUser,
  reauthenticateWithPopup,
  reauthenticateWithRedirect,
  GoogleAuthProvider,
  User,
} from "firebase/auth";
import { db, storage } from "@/lib/firebase";
import { getCurrentTuesday } from "@/lib/utils";
import type { UserProfile, NotificationPrefs } from "@/types";
import { compressImage } from "@/lib/imageUtils";
import { POST_IMAGE_SIZE } from "@/lib/constants";

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
  await uploadBytes(imgRef, blob, { contentType: "image/jpeg" });
  const url = await getDownloadURL(imgRef);
  await updateDoc(doc(db, "users", uid), { photoURL: url });
  return url;
}

export async function deleteAccount(user: User): Promise<void> {
  const uid = user.uid;

  // 1. Re-authenticate FIRST (before deleting any data)
  const provider = new GoogleAuthProvider();
  try {
    await reauthenticateWithPopup(user, provider);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (
      err.code === "auth/popup-blocked" ||
      err.code === "auth/popup-closed-by-user" ||
      err.code === "auth/cancelled-popup-request"
    ) {
      await reauthenticateWithRedirect(user, provider);
      return; // redirect will reload the page
    }
    throw e;
  }

  // 2. Delete all user posts + their likes/reports subcollections
  let hasMore = true;
  while (hasMore) {
    const postsQ = query(collection(db, "posts"), where("userId", "==", uid), limit(500));
    const postsSnap = await getDocs(postsQ);
    if (postsSnap.docs.length === 0) {
      hasMore = false;
    } else {
      // Delete subcollections (likes, reports) for each post
      for (const postDoc of postsSnap.docs) {
        try {
          const likesSnap = await getDocs(collection(db, "posts", postDoc.id, "likes"));
          if (likesSnap.docs.length > 0) {
            const likesBatch = writeBatch(db);
            likesSnap.docs.forEach((d) => likesBatch.delete(d.ref));
            await likesBatch.commit();
          }
        } catch {}
        try {
          const reportsSnap = await getDocs(collection(db, "posts", postDoc.id, "reports"));
          if (reportsSnap.docs.length > 0) {
            const reportsBatch = writeBatch(db);
            reportsSnap.docs.forEach((d) => reportsBatch.delete(d.ref));
            await reportsBatch.commit();
          }
        } catch {}
      }
      // Delete the post documents
      const batch = writeBatch(db);
      postsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      hasMore = postsSnap.docs.length === 500;
    }
  }

  // 3. Delete post images from storage
  try {
    const storageRef = ref(storage, `posts/${uid}`);
    const files = await listAll(storageRef);
    await Promise.all(files.items.map((item) => deleteObject(item)));
  } catch {}

  // 4. Delete avatar from storage
  try {
    await deleteObject(ref(storage, `avatars/${uid}.jpg`));
  } catch {}

  // 5. Delete likes this user left on OTHER people's posts + fix likeCount
  try {
    const likesQ = query(collectionGroup(db, "likes"), where("userId", "==", uid), limit(500));
    const likesSnap = await getDocs(likesQ);
    if (likesSnap.docs.length > 0) {
      const likesBatch = writeBatch(db);
      likesSnap.docs.forEach((d) => {
        likesBatch.delete(d.ref);
        const postRef = d.ref.parent.parent;
        if (postRef) likesBatch.update(postRef, { likeCount: increment(-1) });
      });
      await likesBatch.commit();
    }
  } catch {}

  // 6. Leave all groups + clean up messages & lastRead
  const memberGroupsQ = query(collection(db, "groups"), where("memberIds", "array-contains", uid), limit(50));
  const groupsSnap = await getDocs(memberGroupsQ);
  for (const groupDoc of groupsSnap.docs) {
    const data = groupDoc.data();
    if (data.creatorId === uid) {
      await updateDoc(groupDoc.ref, {
        isClosed: true,
        memberIds: arrayRemove(uid),
        memberCount: increment(-1),
      });
    } else {
      await updateDoc(groupDoc.ref, {
        memberIds: arrayRemove(uid),
        memberCount: increment(-1),
      });
    }

    // Delete lastRead tracking
    try {
      await deleteDoc(doc(db, "groups", groupDoc.id, "lastRead", uid));
    } catch {}

    // Delete messages by this user
    try {
      const msgsQ = query(collection(db, "groups", groupDoc.id, "messages"), where("userId", "==", uid), limit(500));
      const msgsSnap = await getDocs(msgsQ);
      if (msgsSnap.docs.length > 0) {
        const msgBatch = writeBatch(db);
        msgsSnap.docs.forEach((d) => msgBatch.delete(d.ref));
        await msgBatch.commit();
      }
    } catch {}
  }

  // 7. Delete following subcollection
  try {
    const followingSnap = await getDocs(collection(db, "users", uid, "following"));
    if (followingSnap.docs.length > 0) {
      const batch2 = writeBatch(db);
      followingSnap.docs.forEach((d) => batch2.delete(d.ref));
      await batch2.commit();
    }
  } catch {}

  // 8. Delete private subcollection (fcmToken, blockedUsers)
  try {
    await deleteDoc(doc(db, "users", uid, "private", "config"));
  } catch {}

  // 9. Delete user document
  await deleteDoc(doc(db, "users", uid));

  // 10. Delete Firebase Auth account (must be last)
  await deleteUser(user);
}

export async function submitReport(
  reporterId: string,
  targetUserId: string,
  reason: string,
  imageFile: File
): Promise<void> {
  const compressed = await compressImage(imageFile, { maxSize: POST_IMAGE_SIZE });
  const imgRef = ref(storage, `reports/${reporterId}_${Date.now()}.jpg`);
  await uploadBytes(imgRef, compressed, { contentType: "image/jpeg" });
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
  const privRef = doc(db, "users", myUid, "private", "config");
  await updateDoc(privRef, { blockedUsers: arrayUnion(targetUid) });
}

export async function unblockUser(myUid: string, targetUid: string): Promise<void> {
  const privRef = doc(db, "users", myUid, "private", "config");
  await updateDoc(privRef, { blockedUsers: arrayRemove(targetUid) });
}

export async function saveFCMToken(uid: string, token: string): Promise<void> {
  const privRef = doc(db, "users", uid, "private", "config");
  await updateDoc(privRef, { fcmToken: token });
}

export async function fetchNotificationPrefs(uid: string): Promise<NotificationPrefs> {
  const snap = await getDoc(doc(db, "users", uid, "private", "config"));
  const data = snap.data();
  return {
    likes: data?.notificationPrefs?.likes !== false,
    groupMessage: data?.notificationPrefs?.groupMessage !== false,
    streakWarning: data?.notificationPrefs?.streakWarning !== false,
  };
}

export async function updateNotificationPrefs(uid: string, prefs: NotificationPrefs): Promise<void> {
  const privRef = doc(db, "users", uid, "private", "config");
  await updateDoc(privRef, { notificationPrefs: prefs });
}

export async function fetchAdminConfig() {
  const snap = await getDoc(doc(db, "admin_config", "main"));
  return snap.exists() ? snap.data() : null;
}

// ─── Legal documents (Firestore with fallback) ───

export interface LegalDoc {
  contentJa: string;
  contentEn: string;
}

const legalCache: Record<string, LegalDoc | null> = {};

export async function fetchLegalDoc(docId: "terms" | "privacy" | "legal_notice"): Promise<LegalDoc | null> {
  if (legalCache[docId] !== undefined) return legalCache[docId];
  try {
    const snap = await getDoc(doc(db, "legal_docs", docId));
    if (snap.exists()) {
      const data = snap.data();
      const result: LegalDoc = {
        contentJa: data.contentJa || data.content_ja || "",
        contentEn: data.contentEn || data.content_en || "",
      };
      legalCache[docId] = result;
      return result;
    }
  } catch {
    // Firestore fetch failed — fall through to null
  }
  legalCache[docId] = null;
  return null;
}

/** Update week streak when streak threshold post of the week is made */
export async function updateWeekStreak(
  uid: string,
  currentWeekStreak?: number,
  lastCompletedWeekStart?: string
): Promise<void> {
  const tuesdayStart = getCurrentTuesday();
  const currentTuesday = tuesdayStart.toISOString().slice(0, 10);

  // Check if last completed week was the previous Tuesday (consecutive)
  const prevTuesday = new Date(tuesdayStart);
  prevTuesday.setDate(prevTuesday.getDate() - 7);
  const prevTuesdayStr = prevTuesday.toISOString().slice(0, 10);

  let newWeekStreak: number;
  if (lastCompletedWeekStart === prevTuesdayStr) {
    newWeekStreak = (currentWeekStreak || 0) + 1;
  } else {
    newWeekStreak = 1;
  }

  await updateDoc(doc(db, "users", uid), {
    weekStreak: newWeekStreak,
    lastCompletedWeekStart: currentTuesday,
  });
}
