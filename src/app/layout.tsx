import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  title: { default: "KYM Mail", template: "%s | KYM Mail" },
  description: "Your inbox. Your career. Your future.",
  applicationName: "KYM Mail",
  robots: { index: false, follow: false },
  openGraph: {
    title: "KYM Mail",
    description: "Your inbox. Your career. Your future.",
    siteName: "KYM Mail",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${inter.variable} ${montserrat.variable}`}><body>{children}</body></html>;
}
