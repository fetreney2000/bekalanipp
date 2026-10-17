import type { NextConfig } from "next";

const securityHeaders = [
  {
    // Clickjacking: never allow the app to be embedded in an iframe.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Prevent MIME-type sniffing of responses.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  // NOTE: Content-Security-Policy is deliberately NOT listed here. A static
  // header cannot carry a per-request nonce, so the policy lives in
  // src/proxy.ts, which mints one per request and hands it to the App Router
  // renderer. A second static CSP here would only fight with it.
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongodb"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
