import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import TileDraftProvider from "@/components/tile/TileDraftProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tile 360° Preview",
  description: "Upload your tile design, choose a place and size, then preview it in an interactive 360° room.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TileDraftProvider>{children}</TileDraftProvider>
      </body>
    </html>
  );
}
