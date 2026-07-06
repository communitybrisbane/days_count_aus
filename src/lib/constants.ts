export const FOCUS_MODES = [
  { id: "english", label: "English", icon: "english", description: "IELTS, speaking, language exchange" },
  { id: "skill", label: "Skill", icon: "skill", description: "Coding, AI, SNS, portfolio" },
  { id: "challenge", label: "Challenge", icon: "challenge", description: "Road trips, farm, beach, new cities" },
] as const;

export type FocusModeId = (typeof FOCUS_MODES)[number]["id"];

/** All modes are selectable as main mode */
export const MAIN_MODE_OPTIONS = FOCUS_MODES;

/** Map legacy mode IDs to new IDs (work/chill retired 2026-07: both fold into challenge) */
export const LEGACY_MODE_MAP: Record<string, string> = {
  enjoying: "challenge",
  challenging: "challenge",
  adventure: "challenge",
  skills: "skill",
  "social-media": "challenge",
  daily: "challenge",
  work: "challenge",
  chill: "challenge",
};

/** Resolve a mode ID, mapping legacy IDs to new ones */
export function resolveMode(mode: string): string {
  return LEGACY_MODE_MAP[mode] || mode;
}

/** Hashtags are custom-only (per-mode suggestions were dropped) */
export const HASHTAG_MAX = 5;

export const MILESTONES = [30, 100, 200, 365] as const;

export const GRADIENTS = [
  "from-blue-500 to-cyan-400",         // english
  "from-violet-500 to-purple-400",     // skill
  "from-emerald-500 to-teal-400",      // challenge
] as const;

/** Weekly XP rewards — escalating per day (index 0 = 1st post, index 6 = 7th) */
export const WEEKLY_XP = [10, 12, 15, 20, 30, 40, 60] as const;
/** Minimum posts per week to keep streak alive */
export const WEEK_STREAK_THRESHOLD = 5;
/** Consecutive week bonus: +5 XP per post per streak week (max 10 weeks) */
export const WEEK_STREAK_BONUS = 5;
export const WEEK_STREAK_MAX = 10;

export const MAX_GROUP_MEMBERS = 12;
export const DAILY_LIKE_LIMIT = 5;
export const MESSAGE_CHAR_LIMIT = 100;
export const POST_CONTENT_MAX = 350; // ~35 chars/line x 10 lines at 70% image width
export const NICKNAME_MAX = 15;
export const GROUP_NAME_MAX = 30;
export const GOAL_MAX = 100;
export const POST_IMAGE_SIZE = 1024;
export const AVATAR_SIZE = 512;
export const GROUP_JOIN_LEVEL = 2;
export const GROUP_CREATE_LEVEL = 2;

/** Community slots unlocked by level (mode group is always free) */
export const GROUP_SLOT_TIERS = [
  { level: 2, slots: 1 },
  { level: 3, slots: 2 },
  { level: 5, slots: 3 },
] as const;

/** Get max community slots for a given level */
export function getMaxCommunitySlots(level: number): number {
  let slots = 0;
  for (const tier of GROUP_SLOT_TIERS) {
    if (level >= tier.level) slots = tier.slots;
  }
  return slots;
}
export const FIRST_POST_BONUS = 0;
export const POST_XP = 10;
export const POST_XP_DAILY_MAX = 3;
export const LIKE_SEND_XP = 3;
export const LIKE_RECEIVE_XP = 5;

/** Bottom navigation bar height (CSS value) — keep in sync with BottomNav h-10 + its safe-area padding (--safe-bottom) minus its sink into the OS-reserved zone (--nav-sink); both defined by globals.css / SafeAreaTuner */
export const NAV_HEIGHT = "calc(2.5rem + var(--safe-bottom, 0px) - var(--nav-sink, 0px))";

/** Region → IANA timezone (mirrors REGION_TZ in functions/src/index.ts) */
export const REGION_TZ: Record<string, string> = {
  "Sydney": "Australia/Sydney",
  "Melbourne": "Australia/Melbourne",
  "Hobart": "Australia/Hobart",
  "Canberra": "Australia/Sydney",
  "Brisbane": "Australia/Brisbane",
  "Gold Coast": "Australia/Brisbane",
  "Cairns": "Australia/Brisbane",
  "Adelaide": "Australia/Adelaide",
  "Darwin": "Australia/Darwin",
  "Perth": "Australia/Perth",
  "Japan": "Asia/Tokyo",
};
export const DEFAULT_TZ = "Australia/Sydney";

// Japan first (pre-departure users), then Australian cities A-Z, Other last
export const REGIONS = [
  "Japan",
  "Adelaide",
  "Brisbane",
  "Cairns",
  "Canberra",
  "Darwin",
  "Gold Coast",
  "Hobart",
  "Melbourne",
  "Perth",
  "Sydney",
  "Other",
] as const;
