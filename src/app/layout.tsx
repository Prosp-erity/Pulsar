import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/trading/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pulsar — Crypto Scalping Engine",
  description: "Multi-pair crypto scalping engine with 5 proven strategies, AI assistant, dynamic trailing stops, and institutional risk management.",
  keywords: ["crypto scalping", "trading bot", "backtested strategies", "Next.js", "real-time trading"],
  authors: [{ name: "Pulsar Engine" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Pulsar — Crypto Scalping Engine",
    description: "AI-powered crypto scalping with 5 proven strategies",
    url: "https://chat.z.ai",
    siteName: "Pulsar",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pulsar — Crypto Scalping Engine",
    description: "AI-powered crypto scalping with 5 proven strategies",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
