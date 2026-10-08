import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PwaRegister } from "@/components/PwaRegister";

/** Closest widely-licensed match to Ondo's Gellix: geometric, medium weight headlines. */
const sans = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

const body = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://openvenue.xyz"),
  title: "OpenVenue - Session-aware tokenized stocks on BSC",
  description:
    "Institutional-grade routing across bStocks, Ondo, and xStocks on BNB Smart Chain. Simulate, execute, park idle cash.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    title: "OpenVenue",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "OpenVenue",
    description: "Session-aware tokenized stock router on BNB Smart Chain.",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d1d1d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookies = (await headers()).get("cookie");

  return (
    <html lang="en">
      <body className={`${sans.variable} ${body.variable} ${mono.variable}`}>
        <Providers cookies={cookies}>
          <div className="shell">{children}</div>
          <PwaRegister />
        </Providers>
      </body>
    </html>
  );
}
