import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home — days-count",
  description: "Track your working holiday countdown, weekly goals, and XP progress.",
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
