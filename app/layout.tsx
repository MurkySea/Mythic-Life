import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Geist, Geist_Mono, Cinzel } from 'next/font/google'
import './globals.css'
import './world.css'
import './utility-density.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const cinzel = Cinzel({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Mythic Life',
  description: 'Private dark fantasy productivity RPG',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mythic Life',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  themeColor: '#040608',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} antialiased text-white`}>
        <div className="world-shell">
          <div className="world-atmosphere" aria-hidden>
            <div className="world-aurora world-aurora-gold" />
            <div className="world-aurora world-aurora-blue" />
            <div className="world-grid" />
            <div className="world-vignette" />
          </div>
          <div className="world-content mythic-bg">{children}</div>
        </div>
      </body>
    </html>
  )
}
