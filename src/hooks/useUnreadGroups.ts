"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, collection, query, where, getCountFromServer, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface GroupLiveData {
  lastMessageText?: string;
  lastMessageBy?: string;
  lastMessageAt?: Timestamp;
  unreadCount: number;
}

/**
 * Listens to group docs in real-time and counts unread messages.
 * Also returns live lastMessageText/At/By for each group.
 */
export function useUnreadGroups(userId: string | undefined, groupIds: string[]) {
  const [unreadMap, setUnreadMap] = useState<Map<string, number>>(new Map());
  const [liveDataMap, setLiveDataMap] = useState<Map<string, GroupLiveData>>(new Map());

  useEffect(() => {
    if (!userId || groupIds.length === 0) {
      setUnreadMap(new Map());
      setLiveDataMap(new Map());
      return;
    }

    const lastReadAtMap = new Map<string, Timestamp | null>();
    const unsubs: (() => void)[] = [];
    let cancelled = false;

    const countUnread = async (gid: string) => {
      const readAt = lastReadAtMap.get(gid);
      try {
        const messagesRef = collection(db, "groups", gid, "messages");
        const q = readAt
          ? query(messagesRef, where("createdAt", ">", readAt))
          : query(messagesRef);
        const snap = await getCountFromServer(q);
        return snap.data().count;
      } catch {
        return 0;
      }
    };

    Promise.all(
      groupIds.map(async (gid) => {
        try {
          const snap = await getDoc(doc(db, "groups", gid, "lastRead", userId));
          lastReadAtMap.set(gid, snap.exists() ? (snap.data().readAt as Timestamp) : null);
        } catch {
          lastReadAtMap.set(gid, null);
        }
      })
    ).then(() => {
      if (cancelled) return;

      for (const gid of groupIds) {
        const unsub = onSnapshot(
          doc(db, "groups", gid),
          async (snap) => {
            if (cancelled || !snap.exists()) return;
            const data = snap.data();

            const lastMessageAt = data.lastMessageAt as Timestamp | null;
            const lastMessageText = data.lastMessageText as string | undefined;
            const lastMessageBy = data.lastMessageBy as string | undefined;
            const readAt = lastReadAtMap.get(gid);

            // No messages or already read
            if (!lastMessageAt || (readAt && lastMessageAt.toMillis() <= readAt.toMillis())) {
              setUnreadMap((prev) => {
                if ((prev.get(gid) || 0) === 0) return prev;
                const next = new Map(prev);
                next.set(gid, 0);
                return next;
              });
              setLiveDataMap((prev) => {
                const next = new Map(prev);
                next.set(gid, { lastMessageText, lastMessageBy, lastMessageAt: lastMessageAt ?? undefined, unreadCount: 0 });
                return next;
              });
              return;
            }

            const count = await countUnread(gid);
            if (cancelled) return;
            setUnreadMap((prev) => {
              if (prev.get(gid) === count) return prev;
              const next = new Map(prev);
              next.set(gid, count);
              return next;
            });
            setLiveDataMap((prev) => {
              const next = new Map(prev);
              next.set(gid, { lastMessageText, lastMessageBy, lastMessageAt: lastMessageAt ?? undefined, unreadCount: count });
              return next;
            });
          },
          () => { /* ignore errors */ }
        );
        unsubs.push(unsub);
      }
    });

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [userId, groupIds.join(",")]);

  let totalUnread = 0;
  unreadMap.forEach((count) => { totalUnread += count; });

  return { unreadMap, liveDataMap, totalUnread };
}
