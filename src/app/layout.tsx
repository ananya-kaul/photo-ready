import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Indian Passport Photo Maker | 35 × 45 mm Photo Online",
  description: "Prepare a print-ready 35 × 45 mm passport-style photo from a selfie. Private browser processing, white background, 300 DPI JPEG under 50 KB.",
  openGraph: { title: "PhotoReady — Indian Passport Photo Maker", description: "A simple way to prepare a 35 × 45 mm photo from your selfie.", type: "website" },
  robots: { index: true, follow: true },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-IN"><body>{children}</body></html>;
}
