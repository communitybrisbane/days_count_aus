"use client";

import { WEEKLY_XP, WEEK_STREAK_BONUS, WEEK_STREAK_MAX, WEEK_STREAK_THRESHOLD } from "@/lib/constants";

// Rainbow streak colors: 0=gray, 1=red, 2=orange, 3=yellow, 4=green, 5=cyan, 6=blue, 7=purple, 8=pink, 9=gold, 10=rainbow
const RANK_COLORS = [
  { bg: "bg-gray-100", border: "border-gray-300/60", text: "text-gray-500" },
  { bg: "bg-red-50", border: "border-red-300/60", text: "text-red-500" },
  { bg: "bg-orange-50", border: "border-orange-300/60", text: "text-orange-500" },
  { bg: "bg-yellow-50", border: "border-yellow-300/60", text: "text-yellow-600" },
  { bg: "bg-emerald-50", border: "border-emerald-300/60", text: "text-emerald-600" },
  { bg: "bg-cyan-50", border: "border-cyan-300/60", text: "text-cyan-600" },
  { bg: "bg-blue-50", border: "border-blue-300/60", text: "text-blue-600" },
  { bg: "bg-purple-50", border: "border-purple-300/60", text: "text-purple-600" },
  { bg: "bg-pink-50", border: "border-pink-300/60", text: "text-pink-500" },
  { bg: "bg-amber-50", border: "border-amber-400/60", text: "text-amber-600" },
  { bg: "bg-fuchsia-50", border: "border-fuchsia-300/60", text: "text-fuchsia-600" },
];

const BAR_GRADIENTS = [
  "from-gray-300/80 to-gray-200/80",
  "from-red-400/80 to-red-300/80",
  "from-orange-400/80 to-orange-300/80",
  "from-yellow-400/80 to-yellow-300/80",
  "from-emerald-400/80 to-emerald-300/80",
  "from-cyan-400/80 to-cyan-300/80",
  "from-blue-400/80 to-blue-300/80",
  "from-purple-500/80 to-purple-300/80",
  "from-pink-400/80 to-pink-300/80",
  "from-amber-500/80 to-amber-300/80",
  "from-fuchsia-500 via-blue-500 to-emerald-400",
];

const BONUS_TEXT_COLORS = [
  "text-gray-500",
  "text-red-500",
  "text-orange-500",
  "text-yellow-600",
  "text-emerald-600",
  "text-cyan-600",
  "text-blue-600",
  "text-purple-600",
  "text-pink-500",
  "text-amber-600",
  "text-fuchsia-600",
];


interface Props {
  weekStreak: number;
  weeklyPostCount: number;
  goalCleared: boolean;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getWeekRange(): string {
  const now = new Date();
  const day = now.getDay();
  const daysSinceTuesday = (day + 5) % 7;
  const tue = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceTuesday);
  const mon = new Date(tue);
  mon.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${MONTH_ABBR[d.getMonth()]}. ${d.getDate()}`;
  return `${fmt(tue)} – ${fmt(mon)}`;
}

export default function WeeklyChallenge({ weekStreak, weeklyPostCount, goalCleared }: Props) {
  const ws = Math.min(weekStreak, WEEK_STREAK_MAX);
  const rank = RANK_COLORS[ws];
  const barGrad = BAR_GRADIENTS[ws];
  const completedBarGrad = ws === 0
    ? "from-accent-orange to-amber-300"
    : BAR_GRADIENTS[ws].replace(/\/\d+/g, "");

  return (
    <>
      <div className={`flex items-center gap-1.5 mb-3 ${rank.bg} border ${rank.border} rounded-lg px-3 py-1.5`}>
        <span className={`text-xs font-bold ${rank.text}`}>
          Streak {ws} week{ws !== 1 ? "s" : ""}{ws >= WEEK_STREAK_MAX ? " MAX" : ""}
        </span>
        <span className={`text-[10px] ${rank.text} font-medium ml-auto`}>
          +{ws * WEEK_STREAK_BONUS}/post
        </span>
      </div>

      <p className="text-[10px] text-gray-400 text-right mb-2">{getWeekRange()}</p>

      <div className="relative flex items-end gap-1.5 mb-3">
        {/* Streak threshold dashed line at 5th bar height */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-accent-orange/40 pointer-events-none z-10"
          style={{ bottom: `${20 + (WEEK_STREAK_THRESHOLD - 1) * 8 + 18}px` }}
        />
        <div
          className="absolute right-0 -top-1 pointer-events-none z-10"
          style={{ bottom: `${20 + (WEEK_STREAK_THRESHOLD - 1) * 8 + 19}px`, top: "auto" }}
        >
          <span className="text-[7px] text-accent-orange/50 font-bold">streak</span>
        </div>

        {WEEKLY_XP.map((baseXp, i) => {
          const filled = i < weeklyPostCount;
          const isNext = i === weeklyPostCount;
          const barHeight = 20 + i * 8;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className={`text-[10px] font-bold tabular-nums ${
                filled ? rank.text || "text-accent-orange" : isNext ? "text-gray-500" : "text-gray-300"
              }`}>
                +{baseXp}
              </span>
              <div
                className={`w-full rounded-md transition-all duration-500 ${
                  filled
                    ? goalCleared
                      ? `bg-gradient-to-t ${completedBarGrad}`
                      : `bg-gradient-to-t ${barGrad}`
                    : isNext
                      ? "bg-gray-200 ring-1 ring-gray-300"
                      : "bg-gray-100"
                }`}
                style={{ height: `${barHeight}px` }}
              />
              <span className={`text-[9px] font-bold tabular-nums ${filled ? "text-gray-500" : "text-gray-300"}`}>
                {i + 1}
              </span>
            </div>
          );
        })}
      </div>

      {!goalCleared && weeklyPostCount < 7 && (
        <div className="flex justify-end pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            next: <span className="font-bold text-gray-600">+{WEEKLY_XP[weeklyPostCount]}</span>
            {ws > 0 && (
              <span className={`font-bold ${BONUS_TEXT_COLORS[ws]}`}> +{ws * WEEK_STREAK_BONUS}</span>
            )}
            <span> XP</span>
          </span>
        </div>
      )}
    </>
  );
}
