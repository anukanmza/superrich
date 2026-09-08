import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'LOTTO DEALER PRO',
  description: 'Online Lotto Dealer System',
};

import MainLayout from '../components/MainLayout';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-[#0a0e14] text-[#cdd6f4]">
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
