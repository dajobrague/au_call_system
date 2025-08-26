import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Twilio Voice Webhook',
  description: 'Voice webhook service for Twilio integration',
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
