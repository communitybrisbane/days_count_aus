import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Days Count in AUS",
  description: "Count the days that count — Your working holiday journal in Australia.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "Days Count in AUS",
    description: "Count the days that count — Your working holiday journal in Australia.",
    siteName: "Days Count in AUS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Days Count in AUS",
    description: "Count the days that count — Your working holiday journal in Australia.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Count",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A3C2E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-forest min-h-dvh geo-bg`}
      >
        <AuthProvider>
          <div className="mx-auto max-w-[450px] min-h-dvh bg-forest/80 relative shadow-2xl backdrop-blur-sm overflow-hidden">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
