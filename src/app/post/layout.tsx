import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Post — days-count",
  description: "Share your working holiday experience with the community.",
};

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
