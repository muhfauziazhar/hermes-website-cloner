# Cloning "hostile" targets (gated, CDN-split, Cloudflare, webfont-heavy)

Some clone targets hit nearly every weak point in the pipeline at once. Digital
invitation services (e.g. asthainvitation.com / satumomen themes) are a canonical
example: gated entry, Bootstrap+jQuery fixed-canvas layout, hidden modals, Google +
custom signature webfonts, and assets split across a self-hosted origin plus a
Cloudflare-protected CDN. This file is the field playbook distilled from one such run.

## Recon order that actually works

1. **Smoke-test vision first** (`vision_analyze` on a tiny image). If 400, swap
   `auxiliary.vision.model` and restart the gateway before going further.
2. **Open the gate** ("Open Invitation" / "Enter" / "Masuk"). Confirm content mounted:
   `document.querySelectorAll('section,[class*=section]').length` should be > 0, or check
   for a `.canvas.not-open` → `.canvas` class flip.
3. **Recover real fonts, don't trust computed.** Headless does not paint webfonts.
   ```js
   // declared families (works even when status==="unloaded")
   const fams = []; document.fonts.forEach(f => fams.push({family:f.family, weight:f.weight, style:f.style}));
   // .font-* utility classes → which element uses which font
   const map = [...document.querySelectorAll('[class*="font-"]')].slice(0,40)
     .map(e => ({cls:[...e.classList].filter(c=>c.startsWith('font-')).join(' '), txt:e.textContent.trim().slice(0,30), fs:getComputedStyle(e).fontSize}));
   ```
   Map Google families via `next/font/google`; download custom faces (signature/script
   fonts) and wire with `next/font/local`.
4. **Probe each asset origin before bulk download.**
   ```bash
   curl -sL -A "<browser-UA>" -o /tmp/probe -w "HTTP %{http_code} | %{content_type}\n" "<one-asset-url-per-origin>"
   file /tmp/probe   # confirm it's an image, not HTML
   ```
   Self-hosted origin often = 200; third-party CDN often = 403 Cloudflare.

## Cloudflare-403 CDN assets

Observed: `assets.satumomen.com` returns 403 to curl with browser UA, with Referer
header, AND through a residential SOCKS5 proxy. The browser session (which solved the
CF challenge) is the only client with access — BUT those CDN images are typically
lazy-loaded (absent from DOM until scrolled into view) and may be CORS-tainted
(`canvas.toDataURL()` throws SecurityError). Practical resolution:

- Validate every download: reject if Content-Type isn't `image/*` or magic bytes aren't
  an image. A 403 HTML body saved as `.jpg` is the silent killer.
- If an origin is hard-blocked + lazy-loaded, surface it: tell the user "these N gallery
  images / the audio track are behind Cloudflare and can't be auto-fetched" rather than
  shipping placeholders pretending success.

## CSP / cross-origin CSS

`fetch()` from `browser_console` is blocked by site CSP (`connect-src 'self'`) →
`Failed to fetch`. Cross-origin `styleSheets[].cssRules` throws SecurityError. Use the
`document.fonts` API for font identity; `curl` the CSS file server-side if you need the
raw text (subject to the Cloudflare caveat above).

## Commercial-product caution

These paid theme/invitation services are commercial products. Cloning for internal
pipeline testing is fine; do NOT deploy publicly or redistribute without explicit user
confirmation.
