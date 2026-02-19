import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans } from "next/font/google";
import { Toaster } from "sileo";
import "./globals.css";

const notoSans = Noto_Sans({ variable: "--font-sans", subsets: ["latin"] });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arctravern",
  description: "AI Chat Frontend - Reimagined",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${notoSans.variable} dark`}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster
          position="top-center"
          options={{
            fill: "oklch(0.21 0.006 285.885)",
            styles: { description: "text-white/70!" },
          }}
        />
      </body>
    </html>
  );
}
