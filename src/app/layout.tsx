import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppProvider from "@/components/AppProvider";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: {
    default: "神旅帳｜全国の神社巡礼アプリ",
    template: "%s｜神旅帳",
  },
  description:
    "全国47都道府県100社の神社を探して、GPS参拝記録・御朱印・参拝実績をこの一冊に。神社巡礼アプリ「神旅帳」。",
  applicationName: "神旅帳",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "神旅帳",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "神旅帳｜全国の神社巡礼アプリ",
    description: "全国100社の神社をめぐり、参拝の記録と御朱印をこの一冊に。",
    type: "website",
    locale: "ja_JP",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f1e6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router には pages/_document が無い。CJK は unicode-range 配信の link が軽量 */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-washi-texture min-h-dvh antialiased">
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
