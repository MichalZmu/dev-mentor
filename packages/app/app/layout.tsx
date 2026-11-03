import type { Metadata } from "next";
import { applicationInfo } from "@devmentor/core";
import "./globals.css";

export const metadata: Metadata = {
  title: applicationInfo.name,
  description: applicationInfo.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
