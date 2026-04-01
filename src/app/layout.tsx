import type { Metadata } from 'next'
import { Montserrat, Merriweather, Ubuntu_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { SessionProvider } from '@/components/session-provider'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const fontSans = Montserrat({
  subsets: ['latin'],
  variable: '--font-sans',
})

const fontSerif = Merriweather({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['400', '700'],
})

const fontMono = Ubuntu_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '700'],
})

import { SITE_URL } from '@/lib/site-url'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Life Tenis - Club Sinergia Life',
    template: '%s | Life Tenis',
  },
  description: 'Torneos de tenis del Club Sinergia Life. Ranking, fixture, resultados y perfiles de jugadores.',
  applicationName: 'Life Tenis',
  openGraph: {
    siteName: 'Life Tenis',
    locale: 'es_UY',
    type: 'website',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Life Tenis - Club Sinergia Life' }],
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <SessionProvider>
            {children}
            <Toaster richColors position="top-right" />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
