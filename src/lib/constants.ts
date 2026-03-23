export const FOCUS_MODES = [
  { id: "english", label: "English", icon: "english", description: "English" },
  { id: "skill", label: "Skill", icon: "skill", description: "Skill" },
  { id: "adventure", label: "Challenge", icon: "adventure", description: "Challenge" },
  { id: "work", label: "Work", icon: "work", description: "Work" },
  { id: "chill", label: "Chill", icon: "chill", description: "Chill" },
] as const;

export type FocusModeId = (typeof FOCUS_MODES)[number]["id"];

/** All modes are selectable as main mode (Chill is the catch-all) */
export const MAIN_MODE_OPTIONS = FOCUS_MODES;

/** Map legacy mode IDs to new IDs */
export const LEGACY_MODE_MAP: Record<string, string> = {
  enjoying: "adventure",
  challenging: "adventure",
  skills: "skill",
  "social-media": "chill",
  daily: "chill",
  challenge: "adventure",
};

/** Resolve a mode ID, mapping legacy IDs to new ones */
export function resolveMode(mode: string): string {
  return LEGACY_MODE_MAP[mode] || mode;
}

/** Hashtag suggestions per mode + shared tags */
export const HASHTAG_SUGGESTIONS: Record<string, string[]> = {
  work: ["#work", "#farm", "#hustle", "#earning", "#jobhunt", "#barista", "#warehouse", "#harvest"],
  english: ["#english", "#study", "#ielts", "#speaking", "#conversation", "#vocabulary", "#listening", "#reading"],
  skill: ["#skill", "#coding", "#cooking", "#design", "#learning", "#career", "#newskill", "#portfolio"],
  adventure: ["#challenge", "#travel", "#roadtrip", "#explore", "#beach", "#nature", "#sunset", "#camping"],
  chill: ["#chill", "#daily", "#life", "#cooking", "#home", "#sharehouse", "#routine", "#selfcare"],
};
export const HASHTAG_MAX = 5;

export const MILESTONES = [30, 100, 200, 365] as const;

export const GRADIENTS = [
  "from-blue-500 to-cyan-400",         // english
  "from-violet-500 to-purple-400",     // skill
  "from-emerald-500 to-teal-400",      // adventure
  "from-orange-500 to-amber-400",      // work
  "from-stone-400 to-warm-gray-400",   // chill
] as const;

/** Weekly XP rewards — escalating per day (index 0 = 1st post, index 6 = 7th) */
export const WEEKLY_XP = [5, 7, 10, 15, 25, 35, 50] as const;
export const WEEKLY_XP_TOTAL = WEEKLY_XP.reduce((a, b) => a + b, 0); // 147
/** Minimum posts per week to keep streak alive */
export const WEEK_STREAK_THRESHOLD = 5;
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
