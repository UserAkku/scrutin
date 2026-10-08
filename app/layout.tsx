import type { Metadata } from "next";
import { Anton, Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  title: "Krillo | Website Audit Tool",
  description: "Mission-critical website audits with exact fixes.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
};

import { Providers } from "./providers";
import NextTopLoader from "nextjs-toploader";

import { ClientFooterWrapper } from "@/components/shared/ClientFooterWrapper";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${playfair.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text-primary)]">
        <NextTopLoader color="#1C1919" height={4} showSpinner={false} shadow="none" zIndex={1600} />
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <ClientFooterWrapper>
            <Footer />
          </ClientFooterWrapper>
        </Providers>
      </body>
    </html>
  );
}
