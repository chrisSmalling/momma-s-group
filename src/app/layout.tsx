import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito_Sans, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Momma's Meetup",
  description: "A private, group-based calendar for local toddler outings.",
  appleWebApp: {
    capable: true,
    title: "Momma's",
    statusBarStyle: "default",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#A82C5F",
};

// The global footer used to render here on every page. It's now only
// rendered explicitly on public pages (login, terms, privacy — see
// SiteFooter) — the fixed bottom tab bar in Nav.tsx replaces it for
// signed-in users, and the two would otherwise collide on every authed
// screen. See src/app/(app)/layout.tsx for the tabbar-clearance wrapper.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${nunitoSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
