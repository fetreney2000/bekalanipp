import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import "./globals.css";
import { Providers } from "./provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Bekalan FS, AOH & EMT Jabatan Farmasi Hospital Keningau",
  description: "Sistem Bekalan FS, AOH & EMT Jabatan Farmasi Hospital Keningau",
};

// The nonce-based CSP in src/proxy.ts is per-request, so pages cannot be
// prerendered: build-time HTML would ship script tags with no nonce and a
// strict script-src would block all of them. Rendering per request is the
// documented trade-off of nonce CSP in Next.js.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Mantine's colour-scheme bootstrap is an inline <script>, so it needs the
  // same per-request nonce as Next's own hydration script.
  const nonce = (await headers()).get("x-nonce");

  return (
    <html lang="ms" className={inter.variable} {...mantineHtmlProps}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <ColorSchemeScript nonce={nonce ?? undefined} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
