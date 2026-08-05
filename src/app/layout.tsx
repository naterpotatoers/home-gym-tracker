import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/nav";
import { SeedBanner } from "@/components/ui";
import { loadGymData } from "@/lib/db/snapshot";
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
  title: "Nates Gym",
  description: "Programs, workouts, and strength metrics for the garage gym",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e13" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Per-request cache() means pages' own loadGymData() calls dedupe with this
  // one; the banner renders exactly once, on every route that needs it.
  const data = await loadGymData();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Nav />
        {data.source === "seed" && (
          <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6">
            <SeedBanner />
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
