import { Timestamp } from "firebase/firestore";

export interface Post {
  id: string;
  userId: string;
  mode: string;
  imageUrl: string;
  content: string;
  contentFun?: string;
  contentGrowth?: string;
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
  password?: string;
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
}
