export const FOCUS_MODES = [
  { id: "enjoying", label: "WH Enjoy", icon: "enjoying", description: "WH_enjoy" },
  { id: "challenging", label: "WH Challenge", icon: "challenging", description: "WH_challenge" },
  { id: "english", label: "English", icon: "english", description: "English" },
  { id: "skills", label: "Skill", icon: "skills", description: "Skill" },
  { id: "social-media", label: "SNS", icon: "social-media", description: "SNS" },
] as const;

export type FocusModeId = (typeof FOCUS_MODES)[number]["id"];

export const MILESTONES = [30, 100, 200, 365] as const;

export const GRADIENTS = [
  "from-aussie-gold to-amber-400",
  "from-ocean-blue to-cyan-400",
  "from-outback-clay to-orange-400",
  "from-purple-500 to-pink-400",
  "from-green-500 to-teal-400",
] as const;

export const MAX_GROUP_MEMBERS = 10;
export const DAILY_LIKE_LIMIT = 5;
export const POST_EDIT_WINDOW_MS = 5 * 60 * 1000;

export const REGIONS = [
  // Major cities
  "Sydney",
  "Melbourne",
  "Brisbane",
  "Perth",
  "Adelaide",
  "Gold Coast",
  "Canberra",
  // Regional / Sub cities
  "Cairns",
  "Darwin",
  "Hobart",
  "Townsville",
  "Sunshine Coast",
  "Wollongong",
  "Newcastle",
  "Geelong",
  "Byron Bay",
  "Broome",
  "Alice Springs",
  "Tasmania",
  "Other",
] as const;
