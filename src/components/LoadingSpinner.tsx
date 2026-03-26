interface LoadingSpinnerProps {
  fullScreen?: boolean;
  size?: "sm" | "md";
}

export default function LoadingSpinner({ fullScreen = false, size = "md" }: LoadingSpinnerProps) {
  const imgSize = size === "sm" ? 20 : 28;
  const orbitRadius = size === "sm" ? 22 : 32;
  const count = 7;

  const spinner = (
    <div
      className="relative"
      style={{
        width: orbitRadius * 2 + imgSize,
        height: orbitRadius * 2 + imgSize,
        animation: "orbit 1.8s linear infinite",
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const angle = (360 / count) * i;
        const rad = (angle * Math.PI) / 180;
        const cx = orbitRadius + imgSize / 2;
        const x = cx + orbitRadius * Math.sin(rad) - imgSize / 2;
        const y = cx - orbitRadius * Math.cos(rad) - imgSize / 2;
        return (
          <img
            key={i}
            src="/icons/kangaroo-like.png"
            alt=""
            width={imgSize}
            height={imgSize}
            style={{
              width: imgSize,
              height: imgSize,
              objectFit: "contain",
              position: "absolute",
              top: y,
              left: x,
              opacity: 0.3 + (i / (count - 1)) * 0.7,
            }}
          />
        );
      })}
      <style>{`
        @keyframes orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        {spinner}
      </div>
    );
  }

  return (
    <div className="flex justify-center py-8">
      {spinner}
    </div>
  );
}
