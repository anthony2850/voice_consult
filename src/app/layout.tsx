import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import BottomNav from '@/components/BottomNav'

const GA_ID = process.env.NEXT_PUBLIC_GA_TRACKING_ID
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

export const metadata: Metadata = {
  title: 'MyTone — AI 보이스 코치',
  description: '30초 녹음으로 목소리 떨림, 말 속도, 억양, 크기를 수치로 진단하고, 아쉬운 부분을 매일 훈련으로 다듬는 AI 보이스 코치.',
  keywords: ['목소리', '발성 훈련', '보이스 코치', '음성 분석', 'MyTone'],
  openGraph: {
    title: 'MyTone — AI 보이스 코치',
    description: '목소리를 수치로 진단하고 훈련하세요',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
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
        {/* ── Pretendard Variable — Korean web font ── */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />

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
