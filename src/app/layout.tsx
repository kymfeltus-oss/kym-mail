import type { Metadata } from "next";
import { Inter, Libre_Baskerville, Montserrat, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", display: "swap" });
const libre = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-libre", display: "swap" });

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
  return <html lang="en" className={`${inter.variable} ${montserrat.variable} ${sourceSerif.variable} ${libre.variable}`}><body>{children}</body></html>;
}
