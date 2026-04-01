import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <img
        src="/icons/kangaroo-like.png"
        alt=""
        width={64}
        height={64}
        className="mb-6 opacity-40"
        style={{ objectFit: "contain" }}
      />
      <h1 className="text-2xl font-black text-white/80 mb-2">404</h1>
      <p className="text-sm text-white/40 mb-6">This page doesn&apos;t exist.</p>
      <Link
        href="/home"
        className="bg-accent-orange text-white font-bold text-sm px-6 py-3 rounded-full active:scale-95 transition-transform"
      >
        Back to Home
      </Link>
    </div>
  );
}
