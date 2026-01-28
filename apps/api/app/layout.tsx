export const metadata = {
  title: 'Trail API',
  description: 'Trail API',
  icons: {
    icon: [
      { url: '/brand/trail-fork-light.svg', media: '(prefers-color-scheme: light)' },
      { url: '/brand/trail-fork-dark.svg', media: '(prefers-color-scheme: dark)' },
    ],
  },
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
