import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/toaster'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Waterfall Analysis',
  description: 'Modern investment waterfall analysis tool',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          {children}
          <Toaster />
        </div>
      </body>
    </html>
  )
} 