import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Page — days-count",
  description: "View your profile, posts, and activity on days-count.",
};

export default function MypageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
