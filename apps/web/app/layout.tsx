import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Space_Grotesk } from 'next/font/google';
import Script from 'next/script';
import { cookies } from 'next/headers';
import './globals.css';
import { ToastProvider } from '@/contexts/toast-context';
import LoadingBar from './loading-bar';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['500', '600', '700'],
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${themeClass}`.trim()}
    >
      <body className="min-h-screen bg-surface-950 text-surface-100 antialiased font-sans">
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        <LoadingBar />
        <ToastProvider>{children}</ToastProvider>
      {/* eslint-disable @next/next/no-sync-scripts */}
      {/* impeccable-live-start */}
<script src="http://localhost:8400/live.js?token=0cfa52cf-5b54-45dd-bd57-fbc63b81b77c"></script>
{/* impeccable-live-end */}
      {/* eslint-enable @next/next/no-sync-scripts */}
</body>
    </html>
  );
}
