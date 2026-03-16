"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getFollowingIds } from "@/lib/follow";
import type { UserProfile, UserPrivate } from "@/types";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  privateData: UserPrivate | null;
  loading: boolean;
  following: string[];
  refreshProfile: () => Promise<void>;
  refreshFollowing: () => Promise<void>;
  optimisticFollow: (targetUid: string) => void;
  optimisticUnfollow: (targetUid: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  privateData: null,
  loading: true,
  following: [],
  refreshProfile: async () => {},
  refreshFollowing: async () => {},
  optimisticFollow: () => {},
  optimisticUnfollow: () => {},
});

async function fetchProfileWithRetry(uid: string, retries = 3): Promise<UserProfile | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) return snap.data() as UserProfile;
      return null;
    } catch (e) {
      console.warn(`Profile fetch attempt ${i + 1} failed:`, e);
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateData, setPrivateData] = useState<UserPrivate | null>(null);
  const [following, setFollowing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    const data = await fetchProfileWithRetry(uid);
    setProfile(data);
    // Fetch private data (blockedUsers, fcmToken)
    try {
      const privSnap = await getDoc(doc(db, "users", uid, "private", "config"));
      setPrivateData(privSnap.exists() ? (privSnap.data() as UserPrivate) : { blockedUsers: [], fcmToken: "" });
    } catch {
      setPrivateData({ blockedUsers: [], fcmToken: "" });
    }
  };

  const fetchFollowing = async (uid: string) => {
    try {
      const ids = await getFollowingIds(uid);
      setFollowing(ids);
    } catch {
      setFollowing([]);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  const refreshFollowing = async () => {
    if (user) {
      await fetchFollowing(user.uid);
    }
  };

  const optimisticFollow = (targetUid: string) => {
    setFollowing((prev) => prev.includes(targetUid) ? prev : [...prev, targetUid]);
  };

  const optimisticUnfollow = (targetUid: string) => {
    setFollowing((prev) => prev.filter((id) => id !== targetUid));
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Validate auth token first
        try {
          await firebaseUser.getIdToken(true);
        } catch {
          // Token is truly invalid — sign out
          console.error("Auth token invalid, signing out");
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setFollowing([]);
          setLoading(false);
          return;
        }

        // Auth is valid — set user immediately
        setUser(firebaseUser);

        // Fetch profile/following (may fail on first attempt, retries built in)
        await Promise.all([
          fetchProfile(firebaseUser.uid),
          fetchFollowing(firebaseUser.uid),
        ]);
      } else {
        setUser(null);
        setProfile(null);
        setPrivateData(null);
        setFollowing([]);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, privateData, loading, following, refreshProfile, refreshFollowing, optimisticFollow, optimisticUnfollow }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
