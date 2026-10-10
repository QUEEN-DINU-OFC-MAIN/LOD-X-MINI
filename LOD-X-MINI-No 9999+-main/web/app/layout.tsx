import type { Metadata, Viewport } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';
import SiteBackground from '@/components/SiteBackground';
import Footer from '@/components/Footer';
import { Toaster } from '@/components/ui/toaster';
import { LanguageProvider } from '@/lib/site-lang';

export const metadata: Metadata = {
  title: {
    default: 'LOD X MINI — Free WhatsApp Mini Bot | Sri Lanka',
    template: '%s | LOD X MINI'
  },
  description:
    'LOD X MINI — free Sri Lankan WhatsApp mini bot. Link your number in seconds with QR or pairing code: song & video downloads, AI, status tools, auto reply, channel tools and a rich command menu.',
  icons: {
    icon: [
      { url: '/icon.webp', type: 'image/webp' },
      { url: '/rcd-md-banner.jpg', type: 'image/jpeg' }
    ],
    apple: '/rcd-md-banner.jpg'
  }
};

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="relative flex min-h-screen flex-col bg-transparent text-slate-100 antialiased">
        <LanguageProvider>
          <SiteBackground />
          <NavBar />
          <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </main>
          <Toaster position="top-right" />
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
