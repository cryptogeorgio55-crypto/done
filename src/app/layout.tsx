import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DONE — Your business, DONE.",
  description:
    "DONE is an AI business assistant for small businesses. Tell it about your business once, then press I'M LAZY and it creates your content, offers, replies and follow-ups.",
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
