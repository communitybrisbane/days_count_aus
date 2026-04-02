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
  reportRestricted?: boolean;
  createdAt: Timestamp;
  editableUntil: Timestamp;
  tags?: string[];
  region?: string;
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
  joinType?: "open" | "friends";
}

export interface UserProfile {
  uid: string;
  displayName: string;
  displayNameLower?: string;
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
  restricted?: boolean;
  createdAt?: Timestamp;
}

/** Notification preferences (per-type toggles) */
export interface NotificationPrefs {
  likes: boolean;
  groupMessage: boolean;
  streakWarning: boolean;
}

/** Private user data (stored in users/{uid}/private/config) */
export interface UserPrivate {
  blockedUsers: string[];
  fcmToken: string;
  notificationPrefs?: NotificationPrefs;
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

/** Admin config (admin_config/main) — all flat fields editable in Firebase Console */
export interface AdminConfig {
  announcements?: Announcement[];
  bannerImageUrl?: string;
  meetingLabel?: string;       // e.g. "Study Session"
  meetingUrl?: string;         // Zoom URL — empty/missing = offline
  meetingDescription?: string; // shown when offline
  ai_prompt_template?: string;
}

/** Scrollbar-hiding style for inline use */
export const NO_SCROLLBAR_STYLE: React.CSSProperties = {
  scrollbarWidth: "none",
  msOverflowStyle: "none",
};
