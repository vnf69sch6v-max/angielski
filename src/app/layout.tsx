import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Instrument Serif isn't in next/font/google standard, use local or fallback
// For now we'll load it via Google Fonts link in head
const instrumentSerif = localFont({
  src: [
    {
      path: "./fonts/InstrumentSerif-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/InstrumentSerif-Italic.ttf",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "FluentFlow — Nauka angielskiego",
  description:
    "Inteligentna aplikacja do nauki angielskiego. Spaced repetition, ćwiczenia kontekstowe i adaptacyjny system nauki.",
  keywords: ["angielski", "nauka", "spaced repetition", "B1", "B2", "FluentFlow"],
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
  themeColor: "#0A0A0C",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FluentFlow",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
      </head>
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} antialiased bg-bg text-text-primary font-body`}
      >
        <AuthProvider>{children}</AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
