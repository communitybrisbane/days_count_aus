import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login — days-count",
  description: "Sign in to days-count and start tracking your working holiday in Australia.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
