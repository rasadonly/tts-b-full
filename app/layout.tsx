import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TTS Generator',
  description: 'Text-to-Speech generator using AI voices',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
