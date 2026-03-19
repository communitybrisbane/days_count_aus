export const FOCUS_MODES = [
  { id: "enjoying", label: "WH Enjoy", icon: "enjoying", description: "WH_enjoy" },
  { id: "challenging", label: "WH Challenge", icon: "challenging", description: "WH_challenge" },
  { id: "english", label: "English", icon: "english", description: "English" },
  { id: "skills", label: "Skill", icon: "skills", description: "Skill" },
  { id: "social-media", label: "SNS", icon: "social-media", description: "SNS" },
] as const;

export type FocusModeId = (typeof FOCUS_MODES)[number]["id"];

/** Hashtag suggestions per mode + shared tags */
export const HASHTAG_SUGGESTIONS: Record<string, string[]> = {
  enjoying: ["#adventure", "#travel", "#beach", "#nature", "#roadtrip", "#sunset", "#camping", "#surfing", "#explore"],
  challenging: ["#challenge", "#growth", "#hardwork", "#nevergiveup", "#grind", "#hustle", "#pushthrough", "#overcome"],
  english: ["#english", "#study", "#ielts", "#vocabulary", "#speaking", "#listening", "#reading", "#conversation"],
  skills: ["#skills", "#coding", "#cooking", "#barista", "#farming", "#resume", "#career", "#newskill", "#learning"],
  "social-media": ["#sns", "#content", "#youtube", "#tiktok", "#instagram", "#blog", "#creator", "#editing", "#vlog"],
};
export const HASHTAG_MAX = 5;

export const MILESTONES = [30, 100, 200, 365] as const;

export const GRADIENTS = [
  "from-aussie-gold to-amber-400",
  "from-ocean-blue to-cyan-400",
  "from-outback-clay to-orange-400",
  "from-purple-500 to-pink-400",
  "from-green-500 to-teal-400",
] as const;

/** Weekly XP rewards — escalating per day (index 0 = 1st post, index 6 = 7th) */
export const WEEKLY_XP = [5, 7, 10, 15, 25, 35, 50] as const;
export const WEEKLY_XP_TOTAL = WEEKLY_XP.reduce((a, b) => a + b, 0); // 147
/** Consecutive week bonus: +5 XP per post per streak week (max 10 weeks) */
export const WEEK_STREAK_BONUS = 5;
export const WEEK_STREAK_MAX = 10;

export const MAX_GROUP_MEMBERS = 10;
export const DAILY_LIKE_LIMIT = 5;
export const POST_EDIT_WINDOW_MS = 5 * 60 * 1000;
export const DOUBLE_TAP_DELAY_MS = 300;
export const MESSAGE_CHAR_LIMIT = 100;
export const POST_CONTENT_MAX = 400;
export const NICKNAME_MAX = 15;
export const GROUP_NAME_MAX = 30;
export const GOAL_MAX = 100;
export const POST_IMAGE_SIZE = 1024;
export const AVATAR_SIZE = 512;
export const GROUP_JOIN_LEVEL = 2;
export const GROUP_CREATE_LEVEL = 2;
export const FIRST_POST_BONUS = 100;
export const LIKE_SEND_XP = 5;
export const LIKE_RECEIVE_XP = 10;

export const REGIONS = [
  "Sydney",
  "Melbourne",
  "Brisbane",
  "Perth",
  "Adelaide",
  "Gold Coast",
  "Canberra",
  "Cairns",
  "Darwin",
  "Hobart",
  "Japan",
  "Other",
] as const;
