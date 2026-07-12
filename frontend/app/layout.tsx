import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATP Susunin - Video Editor",
  description: "A browser-based video editor backed by native FFmpeg exports.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
