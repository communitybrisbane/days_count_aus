interface LoadingSpinnerProps {
  fullScreen?: boolean;
  size?: "sm" | "md";
}

export default function LoadingSpinner({ fullScreen = false, size = "md" }: LoadingSpinnerProps) {
  const imgSize = size === "sm" ? 28 : 40;
  const orbitRadius = size === "sm" ? 18 : 24;

  const spinner = (
    <div
      className="relative"
      style={{ width: orbitRadius * 2 + imgSize, height: orbitRadius * 2 + imgSize }}
    >
      {/* Orbit ring */}
      <div
        className="absolute inset-0 rounded-full border-2 border-accent-orange/15"
      />
      {/* Orbiting kangaroo */}
      <div
        className="absolute inset-0"
        style={{
          animation: "orbit 1.4s linear infinite",
        }}
      >
        <img
          src="/icons/kangaroo-like.png"
          alt=""
          width={imgSize}
          height={imgSize}
          style={{
            width: imgSize,
            height: imgSize,
            objectFit: "contain",
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />
      </div>
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
