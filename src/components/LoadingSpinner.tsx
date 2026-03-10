interface LoadingSpinnerProps {
  fullScreen?: boolean;
  size?: "sm" | "md";
}

export default function LoadingSpinner({ fullScreen = false, size = "md" }: LoadingSpinnerProps) {
  const sizeClass = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const spinner = (
    <div className={`animate-spin rounded-full ${sizeClass} border-b-2 border-aussie-gold`} />
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
