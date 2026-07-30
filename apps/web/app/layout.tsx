import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { cookies } from 'next/headers';
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
    try {
      var theme = localStorage.getItem('theme') || 'dark';
      if (theme === 'system') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.classList.add(theme);
      document.cookie = 'theme=' + theme + ';path=/;max-age=31536000';
    } catch(e) {}
  })();
`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get('theme')?.value || '';
  const themeClass = theme || '';

  return (
    <html lang="en" className={`${geistSans.variable} ${themeClass}`.trim()}>
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
