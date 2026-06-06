---
name: clone-website
description: >
  Reverse-engineer and clone any website into a Next.js codebase.
  Multi-phase pipeline: browser inspection → design token extraction →
  component specs → parallel builder agents → visual QA.
  Use when user says "clone website", "rebuild this site", "pixel-perfect clone",
  "reverse-engineer this page", or gives a URL with clone/rebuild intent.
---

# Clone Website (Hermes Agent)

Reverse-engineer one or more target URLs into pixel-perfect Next.js clones using Hermes's native browser and delegation tools.

## Trigger

User provides one or more URLs and asks to clone, rebuild, reverse-engineer, or copy the site.

## Scope Defaults

- **Fidelity:** Pixel-perfect (exact colors, spacing, typography, animations)
- **In scope:** Visual layout, components, interactions, responsive design, demo content
- **Out of scope:** Real backend, auth, real-time features, SEO optimization
- **Output:** Next.js 15 (App Router) + shadcn/ui + Tailwind v4 project. Template repo: `muhfauziazhar/hermes-website-cloner`.

For "hostile" targets (gated entry, Cloudflare-protected CDN assets, heavy webfonts, Bootstrap/jQuery fixed-canvas layouts — e.g. digital invitation services), see `references/hostile-targets.md` for the distilled recon order and asset-fetch playbook.

## Guiding Principles

These separate a real clone from a "close enough" mess. Internalize them — they inform every decision below.

1. **Completeness beats speed.** Every builder agent must receive EVERYTHING it needs: screenshot, exact CSS values, downloaded assets with local paths, real text, component structure. If a builder has to guess a color, font size, or padding, extraction failed. Spend the extra minute extracting one more property rather than shipping an incomplete brief.

2. **Small tasks, perfect results.** Given "build the entire features section," an agent approximates and ships something clearly wrong. Given one focused component with exact CSS, it nails it. Judge each section's complexity: a simple banner = one builder; a section with 3 distinct card variants = one builder per variant plus one for the wrapper. **Complexity budget rule:** if a builder's spec exceeds ~150 lines, the section is too big — split it. This is mechanical; don't override it with "but it's all related."

3. **Real content, real assets.** Extract actual text (`element.textContent`), download every `<img>`/`<video>`, extract inline `<svg>` as React components. This is a clone, not a mockup. **Layered assets matter** — a section that looks like one image is often a background + foreground mockup + overlay icon. Enumerate ALL `<img>` and background-images in each container, including absolutely-positioned overlays. Missing an overlay makes the clone look empty even when the background is right.

4. **Foundation first (sequential, non-negotiable).** Nothing builds until globals.css design tokens, TypeScript types, fonts, and global assets exist. Everything after the foundation can run in parallel; the foundation itself cannot.

5. **Extract how it LOOKS and how it BEHAVES.** A website is not a screenshot. For every element capture appearance (exact `getComputedStyle()`) AND behavior (what changes, what triggers it, how it transitions). Not "the nav changes on scroll" — document the exact trigger (scroll px / IntersectionObserver threshold), both before/after CSS state sets, and the transition (duration, easing, CSS vs JS-driven).

6. **Identify the interaction model BEFORE building — the #1 most expensive mistake.** Building click-based tabs when the original is scroll-driven (or vice versa) means a complete rewrite, not a CSS tweak. Determine it definitively: (a) scroll through slowly FIRST and watch if things change on their own → scroll-driven; (b) only if nothing changes on scroll, click/hover to test for click/hover-driven. Write "INTERACTION MODEL: scroll-driven (IntersectionObserver)" explicitly in every interactive component's spec.

7. **Extract every STATE, not just the default.** Tabs show different cards per tab; headers differ at scroll 0 vs 100; cards have hover effects. Click each tab and capture content+styles per state. For scroll-dependent elements, capture styles at position 0 AND past the trigger, then diff — the diff IS the behavior spec.

8. **Spec files are the source of truth.** Every component gets `docs/research/components/<name>.spec.md` BEFORE any builder is dispatched. The builder receives the spec inline in its prompt; the file also persists as an auditable artifact. No spec file = the builder guesses from whatever fit in the prompt.

9. **Build must always compile.** Every builder verifies `npx tsc --noEmit` before finishing; you verify `npm run build` after each merge. A broken build is never acceptable, even temporarily.

## Phase 0: Detect Running Environment (do this FIRST)

Where Hermes is running changes how you deliver the result — the cloning steps are identical, but the handoff differs.

- **Local mode** (Hermes CLI on the user's own machine): the user can run `npm run dev` and open `localhost:3000` themselves. Deliverable = the project files on disk + a note to run the dev server.
- **Remote mode** (Telegram, Discord, or any messaging gateway): the gateway runs on a SERVER. Browser tools and builders all run server-side and work fine, but the user CANNOT open `localhost:3000` — that port is on the server, not their phone/laptop. You MUST deliver via Phase 6 (push / deploy / archive).

How to tell: if the session source is a messaging platform (Telegram/Discord/etc.) you are in remote mode. If unsure, ask the user: "Lo jalanin Hermes di mesin sendiri (CLI) atau lewat chat (Telegram/Discord)?" Decide the delivery method before Phase 5 so you can wire up deploy if needed.

## Pre-Flight

1. **Validate URLs** — `browser_navigate` to each target, confirm accessible
2. **Verify project scaffold ACTUALLY BUILDS** — `terminal: npm install && npm run lint && npm run typecheck && npm run build` in project dir. All three must pass before you start cloning. A scaffold that "looks complete" but never ran the build is the #1 way these projects ship broken — see "Verify, don't assume" pitfall. If scaffold missing, tell user to use the template repo first.
3. **Pin the stack version and keep ALL references consistent.** The template is Next.js **15**, not 16. ESLint flat config differs between the two: Next 15 needs `FlatCompat` (`@eslint/eslintrc`) + `compat.extends("next/core-web-vitals", "next/typescript")`; Next 16's subpath imports (`import x from "eslint-config-next/core-web-vitals"`) DO NOT resolve under Next 15 and silently break `npm run lint`. If you bump the Next version, update `eslint.config.mjs`, `package.json`, README, and AGENTS.md together — version drift across these files is a recurring bug.
4. **Smoke-test the vision model BEFORE you rely on it.** Visual QA (Phase 5) depends on `vision_analyze`. Some auxiliary vision models reject certain payloads — notably `gpt-4o-mini` via GitHub Models returns HTTP 400 `image media type not supported` on PNG. Catch this in 5 seconds now, not at Phase 5: call `vision_analyze` on any small image once. If it 400s, the fix is to swap the auxiliary vision model: `hermes config set auxiliary.vision.model <vision-capable-model>` (e.g. `gh/gpt-4.1` or `gh/gpt-4o` — full versions accept PNG, the `-mini` does not). **Auxiliary config is read at gateway startup**, so the change only takes effect after a gateway restart / new session — it will NOT apply mid-session. Tell the user to retry after restart.
5. **`npm run check` (lint+typecheck+build) exceeds the 60s foreground timeout on a cold build (~60-90s).** Run it in background with output redirected (`npm run check > _check.log 2>&1` then read the log) or pass a longer timeout from the start — don't waste a turn discovering the timeout.
6. **Create output dirs**: `docs/research/`, `docs/research/components/`, `docs/design-references/`, `scripts/`

## Guiding Principles

These separate a real clone from a "close enough" mess. Internalize them — they inform every decision.

1. **Completeness beats speed.** Every builder agent must receive EVERYTHING it needs: screenshot, exact CSS values, downloaded assets with local paths, verbatim text, component structure. If a builder has to guess a color/size/padding, extraction failed. Extract one more property rather than ship an incomplete brief.
2. **Small tasks, perfect results.** A builder given "build the whole features section" approximates and ships wrong. A builder given one focused component with exact values nails it. When in doubt, make the task smaller. Mechanical rule: spec >~150 lines → split the section (don't override with "but it's all related").
3. **Real content, real assets.** Extract actual text/images/SVGs from the live site — `element.textContent`, download every `<img>`, inline `<svg>` → React components. This is a clone, not a mockup. Only generate content that's clearly server-unique per session.
4. **Layered assets matter.** A section that looks like one image is often background + foreground PNG + overlay icon. Enumerate ALL `<img>` and background-images per container, including absolutely-positioned overlays. A missed overlay makes the clone look empty.
5. **Foundation first (sequential, non-negotiable).** Global CSS tokens, TS types, fonts, favicons, downloaded assets must exist before ANY component is built. Everything after foundation can run parallel.
6. **Extract how it LOOKS and how it BEHAVES.** A site isn't a screenshot. For each element capture appearance (exact `getComputedStyle()`) AND behavior — what changes, the exact trigger (scroll px / IntersectionObserver ratio / click / hover / time), before+after states, and the transition (duration, easing, CSS vs JS-driven).
7. **Identify the interaction model BEFORE building** (the single most expensive mistake). Scroll-driven vs click-driven UIs are not a CSS tweak apart — getting it wrong = full rewrite. Method: don't click first; scroll slowly and watch if things change on their own → scroll-driven (find the mechanism). Only if nothing changes on scroll, test click/hover. Write "INTERACTION MODEL: …" explicitly in every spec.
8. **Extract every state, not just the default.** Tabs show different cards per tab; headers differ at scroll 0 vs 100; cards have hover states. Click each tab and capture per-state content; diff scroll-0 vs scrolled styles to find what changes.
9. **Spec files are the source of truth, and build must always compile.** No builder dispatched without a written spec in `docs/research/components/`. Every builder verifies `npx tsc --noEmit` before finishing; you verify `npm run build` after each merge. A broken build is never acceptable, even temporarily.

## Phase 1: Reconnaissance

### 1.1 Screenshots

For each target URL:

```
browser_navigate(url)
browser_vision(question="Full page layout, all sections visible")  → save screenshot
```

Capture at:
- Desktop: resize to 1440px width
- Mobile: resize to 390px width

Save to `docs/design-references/<hostname>-desktop.png`, `<hostname>-mobile.png`.

### 1.2 Global Design Token Extraction

Use `browser_console(expression)` to run extraction JS:

```javascript
// Extract all design tokens
JSON.stringify({
  colors: {
    background: getComputedStyle(document.body).backgroundColor,
    text: getComputedStyle(document.body).color,
    // Sample key elements
    headings: [...document.querySelectorAll('h1,h2,h3')].slice(0,5).map(h => ({
      tag: h.tagName, color: getComputedStyle(h).color, fontSize: getComputedStyle(h).fontSize
    })),
    links: getComputedStyle(document.querySelector('a')).color,
    buttons: [...document.querySelectorAll('button,a[class*="btn"]')].slice(0,3).map(b => ({
      bg: getComputedStyle(b).backgroundColor, color: getComputedStyle(b).color,
      borderRadius: getComputedStyle(b).borderRadius
    }))
  },
  fonts: [...new Set([...document.querySelectorAll('*')].slice(0,300).map(
    el => getComputedStyle(el).fontFamily
  ))].filter(f => !f.includes('system-ui')),
  spacing: [...new Set([...document.querySelectorAll('*')].slice(0,200).map(
    el => getComputedStyle(el).paddingTop
  ))].filter(s => s !== '0px').slice(0,15),
  radii: [...new Set([...document.querySelectorAll('*')].slice(0,200).map(
    el => getComputedStyle(el).borderRadius
  ))].filter(r => r !== '0px').slice(0,10),
  shadows: [...new Set([...document.querySelectorAll('*')].slice(0,200).map(
    el => getComputedStyle(el).boxShadow
  ))].filter(s => s !== 'none').slice(0,5)
}, null, 2)
```

### 1.3 Asset Discovery

```javascript
JSON.stringify({
  images: [...document.querySelectorAll('img')].map(img => ({
    src: img.src || img.currentSrc, alt: img.alt,
    width: img.naturalWidth, height: img.naturalHeight,
    position: getComputedStyle(img).position,
    zIndex: getComputedStyle(img).zIndex,
    parentClasses: img.parentElement?.className?.toString().split(' ').slice(0,3).join(' ')
  })),
  videos: [...document.querySelectorAll('video')].map(v => ({
    src: v.src || v.querySelector('source')?.src,
    poster: v.poster, autoplay: v.autoplay
  })),
  backgroundImages: [...document.querySelectorAll('*')].filter(el => {
    const bg = getComputedStyle(el).backgroundImage;
    return bg && bg !== 'none' && bg.includes('url');
  }).map(el => ({
    url: getComputedStyle(el).backgroundImage,
    element: el.tagName + '.' + el.className?.toString().split(' ')[0]
  })),
  svgs: [...document.querySelectorAll('svg')].length,
  favicons: [...document.querySelectorAll('link[rel*="icon"]')].map(l => ({
    href: l.href, sizes: l.sizes?.toString()
  }))
}, null, 2)
```

### 1.4 Interaction Sweep (MANDATORY)

Do this BEFORE writing any specs. Missing behaviors = complete rewrites later.

**Scroll sweep:** `browser_navigate` + scroll via JS, observe changes:
- Header transformations on scroll
- Scroll-triggered animations
- Scroll-snap behavior
- IntersectionObserver-driven effects

**Click sweep:** Click every tab, button, accordion. Record content per state.

**Hover sweep:** Hover interactive elements. Record style changes.

**Responsive sweep:** Test at 1440px, 768px, 390px. Record layout changes.

Save findings to `docs/research/BEHAVIORS.md`.

### 1.5 Page Topology

Map every section top-to-bottom. Document:
- Visual order
- Fixed/sticky vs flow content
- Interaction model per section (static / click / scroll / time)
- Dependencies between sections

Save to `docs/research/PAGE_TOPOLOGY.md`.

## Phase 2: Foundation Build (Sequential — do yourself)

1. **Update fonts** in `src/app/layout.tsx` — use `next/font/google` or `next/font/local`
2. **Update `globals.css`** — target's color tokens, spacing, animations, scroll behaviors
3. **Create TypeScript interfaces** in `src/types/`
4. **Extract SVG icons** — inline `<svg>` elements → React components in `src/components/icons.tsx`
5. **Download assets** — the template ships a reusable downloader at `scripts/download-assets.mjs` (a known-good copy lives at `references/download-assets.mjs` in this skill). Save the Phase 1.3 asset-discovery JSON to a manifest file, then:
   ```
   terminal: node scripts/download-assets.mjs docs/research/assets.json
   ```
   It accepts the raw `{ images, videos, backgroundImages }` discovery output OR a flat `[{url, dest}]` list, dedupes, downloads 4-at-a-time with retry, lands files under `public/`. The references copy is HARDENED: validates Content-Type + magic bytes, REJECTS HTML-disguised-as-image (Cloudflare 403 challenge saved as `.jpg` — the silent killer), and prints a per-asset success/fail report (non-zero exit on any failure). Don't re-author it each run — copy from references if missing, and never weaken these guards.
6. **Verify:** `terminal: npm run build`

## Phase 3: Component Spec & Parallel Build

### For each section (top to bottom):

#### Step 1: Extract Component CSS

Use `browser_console(expression)` with the extraction script:

```javascript
(function(selector) {
  const el = document.querySelector(selector);
  if (!el) return JSON.stringify({ error: 'Not found: ' + selector });
  const props = [
    'fontSize','fontWeight','fontFamily','lineHeight','letterSpacing','color',
    'textTransform','textDecoration','backgroundColor','background',
    'padding','paddingTop','paddingRight','paddingBottom','paddingLeft',
    'margin','marginTop','marginRight','marginBottom','marginLeft',
    'width','height','maxWidth','minWidth','maxHeight','minHeight',
    'display','flexDirection','justifyContent','alignItems','gap',
    'gridTemplateColumns','gridTemplateRows',
    'borderRadius','border','borderTop','borderBottom',
    'boxShadow','overflow','position','top','right','bottom','left','zIndex',
    'opacity','transform','transition','cursor',
    'objectFit','mixBlendMode','filter','backdropFilter',
    'whiteSpace','textOverflow','WebkitLineClamp'
  ];
  function extract(el) {
    const cs = getComputedStyle(el);
    const s = {};
    props.forEach(p => { const v = cs[p]; if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') s[p] = v; });
    return s;
  }
  function walk(el, depth) {
    if (depth > 4) return null;
    const ch = [...el.children];
    return {
      tag: el.tagName.toLowerCase(),
      classes: el.className?.toString().split(' ').slice(0,5).join(' '),
      text: el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
        ? el.textContent.trim().slice(0,200) : null,
      styles: extract(el),
      images: el.tagName === 'IMG'
        ? { src: el.src, alt: el.alt, w: el.naturalWidth, h: el.naturalHeight } : null,
      childCount: ch.length,
      children: ch.slice(0,20).map(c => walk(c, depth+1)).filter(Boolean)
    };
  }
  return JSON.stringify(walk(el, 0), null, 2);
})('SELECTOR')
```

#### Step 2: Write Component Spec

Create `docs/research/components/<name>.spec.md`:

```markdown
# <ComponentName> Specification

## Overview
- Target file: `src/components/<ComponentName>.tsx`
- Screenshot: `docs/design-references/<name>.png`
- Interaction model: static | click-driven | scroll-driven | time-driven

## DOM Structure
<element hierarchy>

## Computed Styles (exact values)
### Container
- display: flex
- padding: 32px 24px
- (every property with exact computed value)

### <Child N>
- (exact values)

## States & Behaviors
### <Behavior name>
- Trigger: <scroll position / click / hover>
- State A (before): <CSS values>
- State B (after): <CSS values>
- Transition: <CSS transition value>

## Per-State Content (if applicable)
### State: "Tab 1"
- Title: "..."
- Cards: [...]

### State: "Tab 2"
- Title: "..."
- Cards: [...]

## Assets
- Background: `public/images/<file>.webp`
- Icons: <IconName> from icons.tsx

## Text Content (verbatim)
<all text copy-pasted from live site>

## Responsive Behavior
- Desktop (1440px): <layout>
- Tablet (768px): <what changes>
- Mobile (390px): <what changes>
```

#### Step 3: Dispatch Builder via delegate_task

```
delegate_task(
  goal="Build <ComponentName> React component matching the spec exactly",
  context="<full spec file contents inline + file path + imports to use>",
  toolsets=["terminal", "file"]
)
```

**Rule:** Each builder gets ONE component. If section has 3+ sub-components, split into multiple builders. Spec content inline in context — never tell builder to "go read the spec file."

**Complexity budget:** If spec exceeds ~150 lines, split the section.

**Don't wait.** Dispatch builder for section N, immediately start extracting section N+1.

#### Step 4: Verify After Each Build

After builder completes:
```
terminal: npm run build
```

Fix any type errors immediately before proceeding.

## Phase 4: Page Assembly

After all components built:

1. Wire everything in `src/app/page.tsx`
2. Implement page-level layout from topology doc
3. Connect props, implement scroll behaviors, intersection observers
4. Verify: `npm run build`

## Phase 5: Visual QA

1. Take new screenshots of the clone at same viewports
2. Use `vision_analyze` to compare clone vs original side-by-side
3. For each discrepancy:
   - Check spec file — was value extracted correctly?
   - If spec wrong: re-extract, update spec, fix component
   - If spec right but component wrong: fix component
4. Test all interactions: scroll, click, hover
5. Only then declare complete.

## Phase 6: Delivery (mode-dependent — see Phase 0)

The clone isn't "done" until the user can actually see it. Pick based on Phase 0:

### Local mode
Tell the user the files are ready and how to view:
```
terminal: npm run dev   → open http://localhost:3000
```
Optionally commit to git. Done.

### Remote mode (Telegram / Discord / etc.)
The user can't reach `localhost`. Deliver one of these — offer the choice, default to deploy preview for mobile:

**Option A — Deploy preview (best for mobile).** Deploy and send a live URL.
- Vercel: `terminal: npx vercel --yes` (or `npx vercel deploy --prebuilt --yes`). Capture the deployment URL from stdout and send it to the user. If the project has a `vercel-deploy-ops` / `vercel-deployment` skill available, follow it for token auth + preview deploys.
- Self-hosted (user's Dokploy/Docker): build the image, push to GHCR, trigger the redeploy webhook (see the user's standard `Dockerfile → GHCR → Dokploy` flow). Send the resulting URL.
- VERIFY before claiming success: `curl -sI <url>` and confirm HTTP 200. A deploy command that "ran" is not a deploy that "works" — fetch the URL yourself.

**Option B — Push to GitHub.** Create/commit to a repo under the user's account, push a branch, send the repo/compare URL. Good when the user wants the code, not a preview.

**Option C — Send archive.** `terminal: tar --exclude=node_modules --exclude=.next -czf /tmp/clone.tar.gz -C <projectdir> .` then deliver with `MEDIA:/tmp/clone.tar.gz`. Fallback when deploy/push aren't set up.

Whichever you pick, the final message to the user must contain the concrete artifact: a clickable URL (verified 200) or the attached file — never just "it's built on the server."

## Pre-Dispatch Checklist

Before dispatching ANY builder:
- [ ] Spec file written with ALL sections filled
- [ ] Every CSS value from `getComputedStyle()`, not estimated
- [ ] Interaction model identified (static / click / scroll / time)
- [ ] All states captured (not just default)
- [ ] Scroll triggers documented (threshold, before/after, transition)
- [ ] All images identified (including layered overlays)
- [ ] Responsive behavior documented (desktop + mobile minimum)
- [ ] Text content verbatim from site
- [ ] Builder prompt under ~150 lines

## Pitfalls

- **Open any entry gate / overlay BEFORE extracting anything.** Many sites (digital invitations, splash/enter screens, "click to continue", age gates) hide the real content behind a gate button. Token extraction run on the cover DOM returns nothing useful. Click the gate (e.g. "Open Invitation", "Enter", "Masuk") FIRST, wait for the real content to mount, THEN extract. If `document.querySelectorAll('section').length` is 0 right after load, the real page almost certainly hasn't mounted yet.
- **Generic `getComputedStyle` selectors silently grab HIDDEN modals/dialogs and return browser DEFAULTS.** Telltale sign: extraction returns `"Times New Roman"`, `border: outset`, `backgroundColor: #efefef (rgb(239,239,239))`, `borderRadius: 0px` on everything — those are unstyled UA defaults, not the site's design. The usual culprit is a hidden exit-confirmation dialog or a `display:none` popup that your broad `h1,h2,h3,p,span,div` query swept up. Fix: scope extraction to the visible main content container, exclude `[role=dialog]`/`[aria-hidden=true]`/`.modal`, and sanity-check that the fonts you got back aren't all `Times New Roman`/`Arial` (a real designed site almost never is). If you see UA defaults, you extracted the wrong nodes — re-scope, don't proceed.
- **The headless browser does NOT render webfonts — `getComputedStyle().fontFamily` reports the FALLBACK, not the real font.** This is separate from the modal trap above: even on correctly-scoped, visible, fully-styled elements, computed `fontFamily` comes back `"Times New Roman"`/`Arial` because the webfont never painted in headless. Trusting it ships a "classic wedding" rendered in Times New Roman — an instant tell. NEVER trust computed `fontFamily` for font identity. Instead, recover the real fonts three ways: (a) `document.fonts.forEach(f => ...)` (FontFace API) lists every declared family + weight/style — this works even when fonts are `unloaded`; (b) scan `document.styleSheets[].cssRules` for `@font-face` rules and `.font-*` utility-class selectors (e.g. `.font-accent`, `.font-brittany-signature`); (c) map each text element to its font *class* (`[class*="font-"]`), not its computed value. Match Google Fonts via `next/font/google`; for custom faces (signature/script fonts), download the woff2 and use `next/font/local`.
- **Cross-origin CSS usually can't be read via `fetch()` (site CSP `connect-src 'self'`) or `cssRules` (SecurityError on cross-origin sheets).** When you try to fetch the theme stylesheet from inside `browser_console` to get `@font-face src` URLs, expect `Failed to fetch`. Workarounds that DO work: `document.fonts` API (above) for font identity, and same-origin sheets are readable via `cssRules`. To get the raw CSS file itself, `curl` it from the terminal (server-side, not subject to browser CSP) — but watch the Cloudflare caveat below.
- **Assets are often split across multiple origins, and one may be Cloudflare-403.** Theme/structural assets on the site's own domain may `curl` fine (HTTP 200) while gallery photos / music / user-content live on a separate CDN behind Cloudflare bot protection that returns **HTTP 403 to curl even with a browser User-Agent, Referer header, AND a residential SOCKS5 proxy.** Two failure modes to guard against: (1) the downloader saves the 403 HTML body as `photo.jpg` and the clone ships broken images — ALWAYS validate Content-Type is `image/*` and check magic bytes after download, reject HTML-disguised-as-image; (2) the only client that passed the Cloudflare challenge is the live browser session — but CDN images are frequently **lazy-loaded** (not in the DOM until you scroll their section into view) and may be **CORS-tainted** (canvas `toDataURL()` throws SecurityError). Probe one asset per origin first (`curl -w "HTTP %{http_code} %{content_type}"`) to decide curl-vs-browser path per origin. If an origin is hard-blocked and lazy-loaded, tell the user those specific assets can't be auto-fetched rather than silently shipping placeholders.
- **Full-page screenshots can be too tall for the vision model (rejected with `image media type not supported` / 400).** A 1265×3175 PNG is a valid file but may still be refused. Before Phase 5 visual QA, capture per-viewport / per-section screenshots instead of one giant full-page image, or downscale. If the vision provider is unavailable entirely, fall back to MANUAL QA: read the rendered DOM, send the screenshots to the user via `MEDIA:` and let them eyeball fidelity — don't declare the clone "done" with QA silently skipped.
- **Flag commercial / paid-product targets before public deploy.** Some clone targets are commercial products (paid themes, SaaS templates — e.g. paid digital-invitation services). Cloning for internal pipeline testing is fine, but do NOT deploy publicly or redistribute the clone without explicitly confirming intent with the user first. Cloning the pipeline ≠ license to republish someone's paid product.
- **#1 mistake:** Building click tabs when original is scroll-driven (or vice versa). Scroll BEFORE clicking.
- **Don't extract only default state.** Click every tab, capture every state.
- **Don't miss layered images.** Background + foreground + overlay = 3 images.
- **Don't approximate CSS.** `text-lg` ≠ `18px` if line-height differs. Extract exact values.
- **Don't reference docs in builder prompts.** All specs inline.
- **Don't skip asset extraction.** Without real images/fonts, clone always looks fake.
- **Don't give builders too much scope.** >150 lines spec = split the section.
- **Don't forget smooth scroll libs.** Check for Lenis, Locomotive Scroll.
- **Verify, don't assume — run the build before declaring done.** The most common failure on these projects: marking "test & push" complete without ever running `npm run build`/`lint`/`typecheck`. A scaffold can look structurally complete (valid files, right folders) and still fail to build. Always run all three and paste the actual output. "Looks done" is not "is done."
- **Watch for Next 15 vs 16 ESLint flat-config mismatch.** If `npm run lint` errors with `Cannot find module 'eslint-config-next/core-web-vitals'`, the config is using Next 16 subpath imports under Next 15. Fix: switch `eslint.config.mjs` to `FlatCompat` + `compat.extends("next/core-web-vitals", "next/typescript")` and add `@eslint/eslintrc` as a devDependency.
- **Keep stack-version references consistent across files.** package.json, README, AGENTS.md, and eslint config must all agree on the Next.js version. Drift between them is a silent bug source.
- **Ship a LICENSE with attribution for derivative templates.** This template derives from MIT-licensed `JCodesMore/ai-website-cloner-template` — any fork/derivative must include a LICENSE file crediting the upstream author. A README that merely says "MIT" without a LICENSE file is an attribution gap.
