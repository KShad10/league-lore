import type { Metadata, Viewport } from "next";
import { Libre_Baskerville, Inter } from "next/font/google";
import "./globals.css";

const libreBaskerville = Libre_Baskerville({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "League Lore | Fantasy Football Almanac & Report Generator",
    template: "%s | League Lore"
  },
  description: "Transform your fantasy football league data into professional weekly reports with AI-powered commentary. Track rivalries, preserve history, and give your league the coverage it deserves.",
  keywords: ["fantasy football", "Sleeper", "league reports", "dynasty", "fantasy sports", "commissioner tools"],
  authors: [{ name: "League Lore" }],
  openGraph: {
    title: "League Lore | Fantasy Football Almanac & Report Generator",
    description: "Transform your league's raw data into professional weekly reports with AI-powered commentary.",
    type: "website",
    locale: "en_US",
    siteName: "League Lore",
  },
  twitter: {
    card: "summary_large_image",
    title: "League Lore | Fantasy Football Almanac & Report Generator",
    description: "Transform your league's raw data into professional weekly reports with AI-powered commentary.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${libreBaskerville.variable} ${inter.variable}`}>
        {children}
      </body>
    </html>
  );
}
