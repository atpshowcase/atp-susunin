import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Splice — Video Editor",
  description: "A minimalist video editor.",
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
