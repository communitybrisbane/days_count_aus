"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FOCUS_MODES, resolveMode } from "@/lib/constants";
import Avatar from "@/components/Avatar";
import { useSwipeDismiss } from "@/hooks/useSwipeDismiss";

interface FollowingProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  mainMode?: string;
  region?: string;
  showRegion?: boolean;
}

interface Props {
  followingIds: string[];
  onClose: () => void;
  onSelect: (uid: string) => void;
}

export default function FollowingModal({ followingIds, onClose, onSelect }: Props) {
  const [profiles, setProfiles] = useState<FollowingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const swipe = useSwipeDismiss(onClose);

  useEffect(() => {
    if (followingIds.length === 0) {
      setLoading(false);
      return;
    }
    (async () => {
      const results: FollowingProfile[] = [];
      const displayIds = followingIds.slice(0, 50);
      for (const uid of displayIds) {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const d = snap.data();
          results.push({
            uid,
            displayName: d.displayName || "",
            photoURL: d.photoURL || "",
            mainMode: d.mainMode,
            region: d.region,
            showRegion: d.showRegion,
          });
        }
      }
      setProfiles(results);
      setLoading(false);
    })();
  }, [followingIds]);

  return (
    <div ref={swipe.bgRef} className="fixed inset-0 z-50 flex justify-center bg-black/40">
      <div ref={swipe.ref} className="w-full max-w-[430px] bg-forest flex flex-col min-h-dvh" {...swipe.handlers}>
        <div className="flex items-center justify-between p-4 border-b border-forest-light/20">
          <button onClick={onClose} className="text-white/40" aria-label="Close">&larr;</button>
          <h3 className="font-bold text-sm text-white/90">Following ({loading ? followingIds.length : profiles.length})</h3>
          <div className="w-8" />
        </div>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-orange" />
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-center text-white/40 py-8 text-sm">Not following anyone yet</p>
          ) : (
            profiles.map((fp) => (
              <button
                key={fp.uid}
                onClick={() => { onClose(); onSelect(fp.uid); }}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-forest-light/10 active:bg-forest-light/10"
              >
                <Avatar
                  photoURL={fp.photoURL}
                  displayName={fp.displayName}
                  uid={fp.uid}
                  size={44}
                />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-bold truncate text-white/90">{fp.displayName}</p>
                  <p className="text-xs text-white/40">
                    {fp.mainMode && FOCUS_MODES.find((m) => m.id === resolveMode(fp.mainMode || ""))?.label}
                    {fp.region && fp.showRegion !== false && ` · ${fp.region}`}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
