import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import DashboardLayout from './components/DashboardLayout'

// Force dynamic rendering - app requires database access
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tweet Publisher - Twitter/X Article Generator',
  description: 'Monitor Twitter/X accounts, generate articles, and publish to WordPress',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <DashboardLayout>{children}</DashboardLayout>
        </Providers>
      </body>
    </html>
  )
}

