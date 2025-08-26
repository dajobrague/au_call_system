import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Voice Agent - Twilio Integration',
  description: 'Airtable-driven call agent with layered architecture',
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
