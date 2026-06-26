import type { Metadata } from "next";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import "./globals.css";
import { Providers } from "./provider";

export const metadata: Metadata = {
  title: "Bekalan Farmasi",
  description: "Sistem Bekalan Ubat - Hospital Keningau",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms" {...mantineHtmlProps}>
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
