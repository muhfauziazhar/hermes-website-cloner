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

## How It Works

5-phase pipeline powered by Hermes Agent tools:

1. **Reconnaissance** — `browser_navigate` + `browser_vision` for screenshots, `browser_console` for CSS extraction
2. **Foundation** — Update fonts, colors, globals; download assets via `terminal`
3. **Component Specs** — Write detailed specs to `docs/research/components/` with exact computed CSS values
4. **Parallel Build** — `delegate_task` spawns builder agents, one per component
5. **Visual QA** — `vision_analyze` compares clone vs original screenshots

## Tech Stack

- Next.js 16 (App Router, React 19, TypeScript strict)
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
```

## License

MIT
