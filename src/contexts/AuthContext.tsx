"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getFollowingIds } from "@/lib/follow";

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  status: "pre-departure" | "in-australia" | "post-return";
  totalXP: number;
  currentStreak: number;
  lastPostAt: string;
  departureDate: string;
  returnStartDate: string;
  mainMode: string;
  region: string;
  goal: string;
  isPro: boolean;
  dailyLikeCount: number;
  lastLikeDate: string;
  blockedUsers: string[];
  groupIds: string[];
  createdAt: unknown;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  following: string[];
  refreshProfile: () => Promise<void>;
  refreshFollowing: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  following: [],
  refreshProfile: async () => {},
  refreshFollowing: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [following, setFollowing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      setProfile(snap.data() as UserProfile);
    } else {
      setProfile(null);
    }
  };

  const fetchFollowing = async (uid: string) => {
    const ids = await getFollowingIds(uid);
    setFollowing(ids);
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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Ensure auth token is fresh before Firestore requests
          await firebaseUser.getIdToken(true);
          await Promise.all([
            fetchProfile(firebaseUser.uid),
            fetchFollowing(firebaseUser.uid),
          ]);
          setUser(firebaseUser);
        } catch (e) {
          console.error("Failed to fetch user data, signing out:", e);
          // Stale session or permission error — clear auth state
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setFollowing([]);
        }
      } else {
        setUser(null);
        setProfile(null);
        setFollowing([]);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, following, refreshProfile, refreshFollowing }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
