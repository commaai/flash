import './globals.css'
import Head from 'next/head'
import { Inter } from 'next/font/google'
import PlausibleProvider from 'next-plausible'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'flash.comma.ai',
  description: 'Update your comma device to the latest software',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <Head>
        <PlausibleProvider domain="flash.comma.ai" trackOutboundLinks />
      </Head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
