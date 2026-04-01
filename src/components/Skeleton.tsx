"use client";

/** Animated shimmer block */
function Block({ className = "" }: { className?: string }) {
  return <div className={`bg-white/[0.06] rounded-lg animate-pulse ${className}`} />;
}

/** Skeleton for the Home page hero + cards */
export function HomeSkeleton() {
  return (
    <div className="px-5 pt-4 space-y-3">
      <Block className="h-24 rounded-2xl" />
      <Block className="h-20 rounded-2xl" />
      <Block className="h-14 rounded-2xl" />
      <Block className="h-40 rounded-2xl" />
    </div>
  );
}

/** Skeleton for explore grid (2-col gallery) */
export function ExploreGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px">
      {Array.from({ length: 6 }).map((_, i) => (
        <Block key={i} className="aspect-square rounded-none" />
      ))}
    </div>
  );
}

/** Skeleton for group chat list */
export function GroupListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <Block className="w-12 h-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Block className="h-3.5 w-2/3" />
            <Block className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a single post card */
export function PostCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <Block className="w-9 h-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Block className="h-3 w-24" />
          <Block className="h-2.5 w-16" />
        </div>
      </div>
      <Block className="w-full aspect-square rounded-none" />
      <div className="p-3 space-y-2">
        <Block className="h-3 w-full" />
        <Block className="h-3 w-2/3" />
      </div>
    </div>
  );
}
