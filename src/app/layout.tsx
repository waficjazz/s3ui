import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { S3BrowserProvider } from "@/context/S3BrowserContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "S3 Browser - On-Premises File Access",
  description: "Secure browser for on-premises S3 storage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <S3BrowserProvider>
          {children}
        </S3BrowserProvider>
      </body>
    </html>
  );
}
