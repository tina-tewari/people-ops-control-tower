import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { DataBanner } from "@/components/DataBanner";
import { getDataset } from "@/lib/data/load";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "People Ops Control Tower",
  description: "Headcount, recruiting and offer data reconciled into one source of truth.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { meta } = getDataset();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <DataBanner meta={meta} />
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
