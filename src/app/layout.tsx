import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Link Roster", description: "CRC Pretoria Link volunteer roster" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1d4ed8" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
