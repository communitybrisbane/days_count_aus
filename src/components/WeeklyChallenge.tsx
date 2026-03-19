"use client";

import { WEEKLY_XP, WEEK_STREAK_BONUS, WEEK_STREAK_MAX } from "@/lib/constants";

const RANK_COLORS = [
  { bg: "bg-gray-50", border: "border-gray-200/60", text: "text-gray-600" },
  { bg: "bg-stone-50", border: "border-stone-300/60", text: "text-stone-600" },
  { bg: "bg-slate-50", border: "border-slate-200/60", text: "text-slate-600" },
  { bg: "bg-amber-50", border: "border-amber-200/60", text: "text-amber-600" },
  { bg: "bg-yellow-50", border: "border-yellow-300/60", text: "text-yellow-700" },
  { bg: "bg-rose-50", border: "border-rose-200/60", text: "text-rose-500" },
  { bg: "bg-red-50", border: "border-red-200/60", text: "text-red-500" },
  { bg: "bg-sky-50", border: "border-sky-200/60", text: "text-sky-600" },
  { bg: "bg-blue-50", border: "border-blue-200/60", text: "text-blue-600" },
  { bg: "bg-violet-50", border: "border-violet-200/60", text: "text-violet-600" },
  { bg: "bg-purple-50", border: "border-purple-300/60", text: "text-purple-700" },
];

const BAR_GRADIENTS = [
  "from-sky-300/80 to-cyan-200/80",
  "from-stone-400/70 to-stone-300/70",
  "from-slate-300/70 to-slate-200/80",
  "from-amber-300/70 to-amber-200/80",
  "from-yellow-400/70 to-yellow-200/80",
  "from-rose-300/70 to-rose-200/80",
  "from-red-400/70 to-red-200/80",
  "from-sky-400/70 to-sky-300/80",
  "from-blue-400/70 to-blue-300/80",
  "from-violet-400/70 to-violet-300/80",
  "from-purple-500/70 to-purple-300/80",
];

const BONUS_TEXT_COLORS = [
  "text-gray-500", "text-stone-500", "text-slate-500", "text-amber-500",
  "text-yellow-600", "text-rose-400", "text-red-400", "text-sky-500",
  "text-blue-500", "text-violet-500", "text-purple-600",
];

const DAY_LABELS = ["T", "W", "T", "F", "S", "S", "M"];

interface Props {
  weekStreak: number;
  weeklyPostCount: number;
  goalCleared: boolean;
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

      <div className="flex items-end gap-1.5 mb-3">
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
              <span className={`text-[9px] font-medium ${filled ? "text-gray-500" : "text-gray-300"}`}>
                {DAY_LABELS[i]}
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
