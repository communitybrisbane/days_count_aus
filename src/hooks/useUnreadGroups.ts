"use client";

import { useEffect, useState, useRef } from "react";
import { doc, getDoc, onSnapshot, collection, query, where, orderBy, getCountFromServer, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface GroupLiveData {
  lastMessageText?: string;
  lastMessageBy?: string;
  lastMessageAt?: Timestamp;
  unreadCount: number;
}

/** Notify all useUnreadGroups instances that a group was read */
export function emitGroupRead(groupId: string) {
  window.dispatchEvent(new CustomEvent("group-read", { detail: groupId }));
}

/**
 * Listens to group docs in real-time and counts unread messages.
 * Uses getCountFromServer to get actual unread count (excluding own messages).
 */
export function useUnreadGroups(userId: string | undefined, groupIds: string[]) {
  const [unreadMap, setUnreadMap] = useState<Map<string, number>>(new Map());
  const [liveDataMap, setLiveDataMap] = useState<Map<string, GroupLiveData>>(new Map());
  const lastReadAtMapRef = useRef<Map<string, Timestamp | null>>(new Map());

  // Listen for "group-read" events from other components (e.g., group chat page)
  useEffect(() => {
    const handler = (e: Event) => {
      const gid = (e as CustomEvent<string>).detail;
      lastReadAtMapRef.current.set(gid, Timestamp.now());
      setUnreadMap((prev) => {
        if ((prev.get(gid) || 0) === 0) return prev;
        const next = new Map(prev);
        next.set(gid, 0);
        return next;
      });
      setLiveDataMap((prev) => {
        const existing = prev.get(gid);
        if (!existing || existing.unreadCount === 0) return prev;
        const next = new Map(prev);
        next.set(gid, { ...existing, unreadCount: 0 });
        return next;
      });
    };
    window.addEventListener("group-read", handler);
    return () => window.removeEventListener("group-read", handler);
  }, []);

  useEffect(() => {
    if (!userId || groupIds.length === 0) {
      setUnreadMap(new Map());
      setLiveDataMap(new Map());
      return;
    }

    const unsubs: (() => void)[] = [];
    let cancelled = false;

    Promise.all(
      groupIds.map(async (gid) => {
        try {
          const snap = await getDoc(doc(db, "groups", gid, "lastRead", userId));
          lastReadAtMapRef.current.set(gid, snap.exists() ? (snap.data().readAt as Timestamp) : null);
        } catch {
          lastReadAtMapRef.current.set(gid, null);
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
            const readAt = lastReadAtMapRef.current.get(gid);

            // Skip if last message was sent by self
            const isSelf = lastMessageBy === userId;
            if (isSelf) {
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

            // If no readAt (never opened) or no new messages, count = 0
            if (!readAt || !lastMessageAt || lastMessageAt.toMillis() <= readAt.toMillis()) {
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

            // Count actual unread messages (after readAt, not by self)
            try {
              const unreadQ = query(
                collection(db, "groups", gid, "messages"),
                where("createdAt", ">", readAt),
                where("senderId", "!=", userId),
                orderBy("createdAt", "asc")
              );
              const countSnap = await getCountFromServer(unreadQ);
              const unreadCount = countSnap.data().count;

              if (cancelled) return;
              setUnreadMap((prev) => {
                if ((prev.get(gid) || 0) === unreadCount) return prev;
                const next = new Map(prev);
                next.set(gid, unreadCount);
                return next;
              });
              setLiveDataMap((prev) => {
                const next = new Map(prev);
                next.set(gid, { lastMessageText, lastMessageBy, lastMessageAt: lastMessageAt ?? undefined, unreadCount });
                return next;
              });
            } catch {
              // Fallback: just mark as 1 unread
              setUnreadMap((prev) => {
                if ((prev.get(gid) || 0) === 1) return prev;
                const next = new Map(prev);
                next.set(gid, 1);
                return next;
              });
              setLiveDataMap((prev) => {
                const next = new Map(prev);
                next.set(gid, { lastMessageText, lastMessageBy, lastMessageAt: lastMessageAt ?? undefined, unreadCount: 1 });
                return next;
              });
            }
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
