import type { Metadata } from "next";
import { IBM_Plex_Mono, Press_Start_2P, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";

const display = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press"
});

const body = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space"
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono"
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  title: "Scrutin",
  description: "Mission-critical website audits with exact fixes for performance, SEO, security, UX, accessibility, and technical health.",
  openGraph: {
    title: "Scrutin",
    description: "Mission-critical website audits with exact fixes.",
    images: ["/og-image.svg"]
  },
  twitter: {
    card: "summary_large_image",
    title: "Scrutin",
    description: "Mission-critical website audits with exact fixes."
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
