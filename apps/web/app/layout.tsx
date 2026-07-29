import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ToastProvider } from '@/contexts/toast-context';
import LoadingBar from './loading-bar';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
});

export const metadata: Metadata = {
  title: 'Workspace OS',
  description: 'Collaborative workspace platform',
};

const themeScript = `
  (function() {
    var theme = localStorage.getItem('theme') || 'dark';
    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.add(theme);
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geistSans.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-surface-950 text-surface-100 antialiased font-sans">
        <LoadingBar />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
