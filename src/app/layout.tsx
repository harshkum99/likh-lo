import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AppShell } from '@/components/app/app-shell'
import { Toaster } from '@/components/ui/toast'
import { ConfirmHost } from '@/components/ui/confirm'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'Likh-lo · Fleet ledger', template: '%s · Likh-lo' },
  description: 'Scan your truck register, track every trip, and see your fleet’s profit at a glance.',
  manifest: '/manifest.json',
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }], apple: '/icon.svg' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Likh-lo' },
}

export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7fb' },
    { media: '(prefers-color-scheme: dark)', color: '#14161f' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
        <Toaster />
        <ConfirmHost />
      </body>
    </html>
  )
}
