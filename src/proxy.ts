import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Per-request Content-Security-Policy with a nonce.
 *
 * Why a proxy: Next.js renders its hydration bootstrap as an inline <script>
 * and its framework CSS as inline <style> tags. A static CSP cannot know the
 * hash of that markup ahead of time, so the only way to keep a strict
 * script-src is to mint a fresh nonce per request and stamp it on those tags.
 * The App Router reads the nonce back out of the *request* CSP header
 * (see next/dist/server/app-render/get-script-nonce-from-header.js), so the
 * value has to be set on both the request headers (for the renderer) and the
 * response headers (for the browser).
 *
 * Cost: because the nonce is per-request, every page is rendered dynamically.
 * Static optimization / ISR / CDN HTML caching are disabled for these routes —
 * the documented trade-off for nonce-based CSP in Next.js.
 */
function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' trusts the nonce-bearing bootstrap, which then loads
    // the hashed /_next/static bundles. 'self' is kept as a CSP2 fallback for
    // older browsers that don't understand strict-dynamic.
    // 'unsafe-eval' is needed only by React's dev-time debugging; neither
    // React nor Next.js use eval in production builds.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Styles keep 'unsafe-inline', and this is not removable by nonces:
    // Mantine sets CSS custom properties through inline style="" attributes
    // (e.g. theming tokens on the DOM), and a nonce only ever applies to
    // <style>/<script> ELEMENTS, never to style attributes. Those are governed
    // by style-src-attr, which a nonce cannot satisfy. Dropping 'unsafe-inline'
    // here would strip all Mantine theming, so scripts get the strict policy
    // and styles stay permissive.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    // next/font self-hosts Inter at build time; no external font CDNs.
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development"
  );

  const requestHeaders = new Headers(request.headers);
  // The renderer needs both: it derives the nonce it stamps on its own
  // <script>/<style> tags from the request CSP header.
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

export const config = {
  // Static assets carry no nonce-bearing markup, so skipping them keeps the
  // proxy off the hot path for /_next/static and images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
