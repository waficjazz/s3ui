import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { S3BrowserProvider } from "@/context/S3BrowserContext";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { ThemeProvider } from "@/context/ThemeContext";
import "./globals.css";
import { cn } from "@/lib/utils";

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
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <S3BrowserProvider>
              {children}
            </S3BrowserProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
