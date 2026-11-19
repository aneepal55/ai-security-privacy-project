import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Care Compass | Health & Wellness Assistant",
  description: "A local AI assistant for general health and wellness information",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
