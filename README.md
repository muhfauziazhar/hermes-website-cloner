# Hermes Website Cloner

Clone any website into a clean, modern Next.js codebase using [Hermes Agent](https://hermes-agent.nousresearch.com).

Inspired by [ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template) — adapted for Hermes Agent's native browser and delegation tools.

## Quick Start

1. **Use this template** — click "Use this template" on GitHub

2. **Clone your copy:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
   cd YOUR-REPO
   npm install
   ```

3. **Start Hermes Agent** and run:
   ```
   /clone-website <target-url>
   ```

## Running Modes

Hermes Agent can drive this pipeline in two environments. The cloning logic is
identical — what differs is **where the project lives** and **how you see the result**.

### Local mode (Hermes CLI on your machine)

The project is cloned to your disk. Inspect the result with a local dev server:

```bash
npm run dev      # → open http://localhost:3000 in your browser
```

Files are right there on your machine.

### Remote mode (Telegram / Discord / any messaging gateway)

When you talk to Hermes through a chat platform, the gateway runs on a **server**,
not your phone or laptop. Everything happens server-side:

- Browser tools (`browser_navigate`, `browser_console`) run **headless** on the server — inspection works fine
- `delegate_task` builders run on the server
- **You can't open `localhost:3000`** — the dev server isn't on your device

So the deliverable comes back to you a different way. Pick one (the agent will offer):

| Option | What you get |
|--------|--------------|
| **Push to GitHub** | Agent commits the clone to a repo — review the diff / pull it later |
| **Deploy preview** | Agent deploys to Vercel (or your Dokploy/Docker host) and sends you a live URL you can open on your phone |
| **Send archive** | Agent `tar`s the project and sends it as a file attachment |

For mobile workflows, **deploy preview** is the smoothest — tap the link, see the
clone live. See [Phase 6 in the skill](#) for the auto-deploy step.

## How It Works

5-phase pipeline powered by Hermes Agent tools:

1. **Reconnaissance** — `browser_navigate` + `browser_vision` for screenshots, `browser_console` for CSS extraction
2. **Foundation** — Update fonts, colors, globals; download assets via `terminal`
3. **Component Specs** — Write detailed specs to `docs/research/components/` with exact computed CSS values
4. **Parallel Build** — `delegate_task` spawns builder agents, one per component
5. **Visual QA** — `vision_analyze` compares clone vs original screenshots

## Tech Stack

- Next.js 15 (App Router, React 19, TypeScript strict) — upgradeable to 16
- shadcn/ui (@base-ui/react primitives)
- Tailwind CSS v4 (oklch design tokens)
- Docker support (multi-stage production build)

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript check |
| `npm run check` | All checks combined |

## Project Structure

```
src/
  app/              # Next.js routes + globals.css
  components/       # React components (built by clone pipeline)
    ui/             # shadcn/ui primitives
    icons.tsx       # Extracted SVG icons
  lib/utils.ts      # cn() utility
  types/            # TypeScript interfaces
  hooks/            # Custom React hooks
public/
  images/           # Downloaded images from target
  videos/           # Downloaded videos from target
  seo/              # Favicons, OG images
docs/
  research/         # Inspection output + component specs
  design-references/ # Screenshots
scripts/            # Asset download scripts
    download-assets.mjs  # Batched downloader (manifest-driven)
```

## Asset Downloader

`scripts/download-assets.mjs` pulls images/videos discovered during reconnaissance:

```bash
# Pass the asset-discovery JSON captured via browser_console in Phase 1
node scripts/download-assets.mjs docs/research/assets.json
```

Accepts the raw `{ images, videos, backgroundImages }` discovery output or a flat
`[{ url, dest }]` list. Downloads run 4-at-a-time with retry; files land under `public/`.

## Attribution

Derived from [ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template)
by JCodesMore (MIT). Adapted for Hermes Agent's native browser + delegation tools.

## License

MIT
