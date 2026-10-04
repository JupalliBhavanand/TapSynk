import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TapSync — AI-powered NFC business cards",
    template: "%s · TapSync",
  },
  description:
    "Tap your NFC card on any phone to share your digital business card, let people save your contact in one tap, and have an AI marketing agent answer questions and book appointments for you.",
  keywords: [
    "NFC business card",
    "digital business card",
    "AI business card",
    "smart business card",
    "virtual business card",
    "contactless business card",
    "AI appointment booking",
  ],
  applicationName: "TapSync",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "TapSync",
    url: SITE_URL,
    title: "TapSync — AI-powered NFC business cards",
    description: "One tap shares your card. An AI agent sells and books for you.",
  },
  twitter: {
    card: "summary_large_image",
    title: "TapSync — AI-powered NFC business cards",
    description: "One tap shares your card. An AI agent sells and books for you.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0f1426",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrains.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
