import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Voice Agent - Twilio Integration',
  description: 'Airtable-driven call agent built with Next.js and Twilio',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
