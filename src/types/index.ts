import { Timestamp } from "firebase/firestore";

export interface Post {
  id: string;
  userId: string;
  mode: string;
  imageUrl: string;
  content: string;
  phase: string;
  dayNumber: number;
  likeCount: number;
  visibility?: "public" | "private";
  status: "active" | "hidden" | "pending";
  reportCount: number;
  createdAt: Timestamp;
  editableUntil: Timestamp;
}

export interface Group {
  id: string;
  mode: string;
  groupName: string;
  creatorId: string;
  memberIds: string[];
  memberCount: number;
  isClosed: boolean;
  isOfficial?: boolean;
  iconUrl?: string;
  goal?: string;
  lastMessageAt?: Timestamp;
  lastMessageText?: string;
  lastMessageBy?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  totalXP: number;
  mainMode: string;
  region: string;
  goal: string;
  currentStreak?: number;
  status?: "pre-departure" | "in-australia" | "post-return";
  departureDate?: string;
  returnStartDate?: string;
  isPro?: boolean;
  dailyLikeCount?: number;
  lastLikeDate?: string;
  weeklyGoal?: number;
  groupIds?: string[];
  showRegion?: boolean;
  weekStreak?: number;
  lastCompletedWeekStart?: string;
  lastPostAt?: string;
  createdAt?: Timestamp;
}

/** Private user data (stored in users/{uid}/private/config) */
export interface UserPrivate {
  blockedUsers: string[];
  fcmToken: string;
}

/** Live Session config (from admin_config/main.liveSession) */
export interface LiveSession {
  label: string;
  url: string;
  description?: string;
}

/** Announcement (from admin_config/main.announcements) */
export interface Announcement {
  title: string;
  body?: string;
  type: "info" | "warning" | "event";
  linkUrl?: string;
  linkLabel?: string;
  active: boolean;
}

/** Admin config (admin_config/main) */
export interface AdminConfig {
  announcements?: Announcement[];
  bannerImageUrl?: string;
  liveSession?: LiveSession;
  ai_prompt_template?: string;
}

/** Scrollbar-hiding style for inline use */
export const NO_SCROLLBAR_STYLE: React.CSSProperties = {
  scrollbarWidth: "none",
  msOverflowStyle: "none",
};
