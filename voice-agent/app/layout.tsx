import type { Metadata } from 'next'
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: 'Healthcare Services - Voice Agent',
  description: 'Professional healthcare job assignment system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
