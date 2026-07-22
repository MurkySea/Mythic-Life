import type { Metadata } from "next";
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

          {/* Bottom navigation */}
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/80 safe-area-bottom">
            <div className="max-w-md mx-auto flex justify-around items-center px-1 py-2.5">
              <Link href="/" className="flex flex-col items-center gap-1 min-w-[56px] text-zinc-500 hover:text-violet-400 transition-colors">
                <span className="text-xl leading-none">⚔</span>
                <span className="text-[10px] font-medium tracking-wide">Today</span>
              </Link>
              <Link href="/mother-list" className="flex flex-col items-center gap-1 min-w-[56px] text-zinc-500 hover:text-violet-400 transition-colors">
                <span className="text-xl leading-none">📜</span>
                <span className="text-[10px] font-medium tracking-wide">Mother List</span>
              </Link>
              <Link href="/gallery" className="flex flex-col items-center gap-1 min-w-[56px] text-zinc-500 hover:text-violet-400 transition-colors">
                <span className="text-xl leading-none">🖼</span>
                <span className="text-[10px] font-medium tracking-wide">Gallery</span>
              </Link>
              <Link href="/messages" className="flex flex-col items-center gap-1 min-w-[56px] text-zinc-500 hover:text-violet-400 transition-colors">
                <span className="text-xl leading-none">💬</span>
                <span className="text-[10px] font-medium tracking-wide">Messages</span>
              </Link>
              <Link href="/companion-profile" className="flex flex-col items-center gap-1 min-w-[56px] text-zinc-500 hover:text-violet-400 transition-colors">
                <span className="text-xl leading-none">🦊</span>
                <span className="text-[10px] font-medium tracking-wide">Profile</span>
              </Link>
            </div>
          </nav>
        </div>
      </body>
    </html>
  );
}
