import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mythic Life",
  description: "Private dark fantasy productivity RPG",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mythic Life",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-white`}>
        <div className="min-h-screen flex flex-col">
          <div className="flex-1 pb-24">
            {children}
          </div>

          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/80 safe-area-bottom">
            <div className="max-w-md mx-auto flex justify-around items-center px-0.5 py-2.5">
              <Link href="/" className="flex flex-col items-center gap-1 min-w-[52px] text-zinc-500 hover:text-violet-400 transition-colors">
                <span className="text-xl leading-none">⚔</span>
                <span className="text-[10px] font-medium tracking-wide">Today</span>
              </Link>
              <Link href="/tasks" className="flex flex-col items-center gap-1 min-w-[52px] text-zinc-500 hover:text-violet-400 transition-colors">
                <span className="text-xl leading-none">📜</span>
                <span className="text-[10px] font-medium tracking-wide">Tasks</span>
              </Link>
              <Link href="/messages" className="flex flex-col items-center gap-1 min-w-[52px] text-zinc-500 hover:text-violet-400 transition-colors">
                <span className="text-xl leading-none">💬</span>
                <span className="text-[10px] font-medium tracking-wide">Chat</span>
              </Link>
              <Link href="/companion-profile" className="flex flex-col items-center gap-1 min-w-[52px] text-zinc-500 hover:text-violet-400 transition-colors">
                <span className="text-xl leading-none">🦊</span>
                <span className="text-[10px] font-medium tracking-wide">Profile</span>
              </Link>
              <Link href="/settings" className="flex flex-col items-center gap-1 min-w-[52px] text-zinc-500 hover:text-violet-400 transition-colors">
                <span className="text-xl leading-none">⚙</span>
                <span className="text-[10px] font-medium tracking-wide">More</span>
              </Link>
            </div>
          </nav>
        </div>
      </body>
    </html>
  );
}
