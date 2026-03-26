interface LoadingSpinnerProps {
  fullScreen?: boolean;
  size?: "sm" | "md";
}

export default function LoadingSpinner({ fullScreen = false, size = "md" }: LoadingSpinnerProps) {
  const imgSize = size === "sm" ? 28 : 40;

  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div
        className="animate-spin"
        style={{ animationDuration: "1.2s" }}
      >
        <img
          src="/icons/kangaroo-like.png"
          alt=""
          width={imgSize}
          height={imgSize}
          style={{ width: imgSize, height: imgSize, objectFit: "contain" }}
        />
      </div>
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
