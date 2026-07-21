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
          {/* Main content */}
          <div className="flex-1 pb-20">
            {children}
          </div>

          {/* Bottom navigation */}
          <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 px-2 py-2 safe-area-bottom">
            <div className="max-w-md mx-auto flex justify-around items-center">
              <Link href="/" className="flex flex-col items-center gap-0.5 text-xs text-zinc-400 hover:text-violet-400 transition">
                <span className="text-lg">⚔</span>
                <span>Today</span>
              </Link>
              <Link href="/mother-list" className="flex flex-col items-center gap-0.5 text-xs text-zinc-400 hover:text-violet-400 transition">
                <span className="text-lg">📜</span>
                <span>Mother List</span>
              </Link>
              <Link href="/messages" className="flex flex-col items-center gap-0.5 text-xs text-zinc-400 hover:text-violet-400 transition">
                <span className="text-lg">💬</span>
                <span>Messages</span>
              </Link>
              <Link href="/companion-profile" className="flex flex-col items-center gap-0.5 text-xs text-zinc-400 hover:text-violet-400 transition">
                <span className="text-lg">🦊</span>
                <span>Profile</span>
              </Link>
            </div>
          </nav>
        </div>
      </body>
    </html>
  );
}