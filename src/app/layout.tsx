import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import BottomNav from '@/components/BottomNav'

const GA_ID = process.env.NEXT_PUBLIC_GA_TRACKING_ID
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

export const metadata: Metadata = {
  title: 'Voice Emotion — 내 목소리 감정 분석',
  description: '목소리 하나로 49가지 감정을 분석합니다. AI가 분석한 당신만의 Voice Emotion 리포트를 확인해 보세요.',
  keywords: ['목소리', '감정분석', '음성분석', 'AI분석', 'Voice Emotion'],
  openGraph: {
    title: 'Voice Emotion',
    description: '목소리 하나로 알아보는 나의 감정 패턴',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <head>
        {/* ── Google Analytics 4 ── */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}</Script>
          </>
        )}

        {/* ── Meta (Facebook) Pixel ── */}
        {PIXEL_ID && (
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
            n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
            s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
            (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','${PIXEL_ID}');
            fbq('track','PageView');
          `}</Script>
        )}
      </head>
      <body className="antialiased bg-background text-foreground">
        {/* Mobile-first: center-column max 480px */}
        <div className="relative min-h-screen mx-auto max-w-[480px] flex flex-col">
          <main className="flex-1 pb-[84px]">
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  )
}
