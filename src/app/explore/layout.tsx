import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore — days-count",
  description: "Discover posts and connect with other working holiday makers in Australia.",
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
