import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Groups — days-count",
  description: "Join or create groups with other working holiday makers.",
};

export default function GroupsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
