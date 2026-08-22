import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
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
  title: "Momma's Meetup",
  description: "A private, group-based calendar for local toddler outings.",
  appleWebApp: {
    capable: true,
    title: "Mommas",
    statusBarStyle: "default",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#C0356E",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="mt-auto border-t border-zinc-200 bg-white px-5 py-6 text-sm text-zinc-500">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>Momma&apos;s Meetup · Local family activities, together.</p>
            <nav aria-label="Site" className="flex flex-wrap gap-4">
              <Link className="hover:text-zinc-900" href="/privacy">Privacy</Link>
              <Link className="hover:text-zinc-900" href="/terms">Terms</Link>
              <Link className="hover:text-zinc-900" href="/account/delete">Delete account</Link>
            </nav>
          </div>
        </footer>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
