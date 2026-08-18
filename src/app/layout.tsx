import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DONE — an intelligent business operating system.",
  description:
    "DONE watches what's happening across your business, understands what matters, and tells you your Next Move — then does the work. Connect your inbox, calendar and leads and it takes it from there.",
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
