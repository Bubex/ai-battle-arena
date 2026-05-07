import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Battle Arena',
  description: 'Bots autônomos em combate 24/7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
