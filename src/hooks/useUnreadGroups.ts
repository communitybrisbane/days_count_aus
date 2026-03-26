"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Listens to group docs in real-time and compares lastMessageAt
 * with the user's lastRead timestamp to determine unread status.
 * Returns a Set of groupIds that have unread messages and the total count.
 */
export function useUnreadGroups(userId: string | undefined, groupIds: string[]) {
  const [unreadSet, setUnreadSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId || groupIds.length === 0) {
      setUnreadSet(new Set());
      return;
    }

    // Track lastMessageAt per group from real-time listeners
    const lastMessageAtMap = new Map<string, Timestamp | null>();
    const lastReadAtMap = new Map<string, Timestamp | null>();
    const unsubs: (() => void)[] = [];

    const recalc = () => {
      const newUnread = new Set<string>();
      for (const gid of groupIds) {
        const msgAt = lastMessageAtMap.get(gid);
        const readAt = lastReadAtMap.get(gid);
        if (msgAt) {
          if (!readAt || msgAt.toMillis() > readAt.toMillis()) {
            newUnread.add(gid);
          }
        }
      }
      setUnreadSet((prev) => {
        // Only update if changed to avoid unnecessary re-renders
        if (prev.size === newUnread.size && [...newUnread].every((id) => prev.has(id))) return prev;
        return newUnread;
      });
    };

    // Fetch lastRead for all groups once
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
      // After lastRead is loaded, set up real-time listeners on group docs
      for (const gid of groupIds) {
        const unsub = onSnapshot(
          doc(db, "groups", gid),
          (snap) => {
            if (snap.exists()) {
              lastMessageAtMap.set(gid, snap.data().lastMessageAt as Timestamp | null);
            }
            recalc();
          },
          () => {
            // Error — ignore
          }
        );
        unsubs.push(unsub);
      }
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [userId, groupIds.join(",")]);

  return { unreadSet, unreadCount: unreadSet.size };
}
