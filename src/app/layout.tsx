import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms" className={inter.variable} {...mantineHtmlProps}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <ColorSchemeScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
