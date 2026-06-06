# Hermes Website Cloner

Reverse-engineer any website into a clean, modern Next.js codebase using Hermes Agent.

## What This Is

A reusable template for cloning websites using Hermes Agent's native tools:
- **Browser tools** (`browser_navigate`, `browser_snapshot`, `browser_vision`, `browser_console`) for inspection
- **`delegate_task`** for parallel builder agents (each builds one component)
- **`write_file` / `terminal`** for asset downloads and code generation
- **`vision_analyze`** for visual QA comparison

## Tech Stack

- **Framework:** Next.js 15 (App Router, React 19, TypeScript strict)
- **UI:** shadcn/ui (@base-ui/react primitives, Tailwind CSS v4, `cn()` utility)
- **Icons:** Lucide React (default — replaced by extracted SVGs during cloning)
- **Styling:** Tailwind CSS v4 with oklch design tokens
- **Deployment:** Vercel or Docker

## Commands

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run lint       # ESLint check
npm run typecheck  # TypeScript check
npm run check      # lint + typecheck + build
```

## Code Style

- TypeScript strict mode, no `any`
- Named exports, PascalCase components, camelCase utils
- Tailwind utility classes, no inline styles
- 2-space indentation
- Responsive: mobile-first

## Design Principles

- **Pixel-perfect emulation** — match spacing, colors, typography exactly
- **No personal aesthetic changes during emulation** — match 1:1 first, customize later
- **Real content** — use actual text and assets from target site, not placeholders
- **Completeness beats speed** — every CSS value must be extracted, not guessed

## Project Structure

```
src/
  app/              # Next.js routes
  components/       # React components
    ui/             # shadcn/ui primitives
    icons.tsx       # Extracted SVG icons as React components
  lib/
    utils.ts        # cn() utility (shadcn)
  types/            # TypeScript interfaces
  hooks/            # Custom React hooks
public/
  images/           # Downloaded images from target site
  videos/           # Downloaded videos from target site
  seo/              # Favicons, OG images, webmanifest
docs/
  research/         # Inspection output (design tokens, components, layout)
  design-references/ # Screenshots and visual references
scripts/            # Asset download scripts
```

## Hermes-Specific Notes

- Use `browser_navigate` + `browser_vision` for screenshots (not MCP browser tools)
- Use `browser_console(expression)` to run `getComputedStyle()` extraction JS
- Use `delegate_task` to spawn parallel builder agents (one per component)
- Each builder gets a self-contained prompt with inline spec — no external doc references
- Use `write_file` to write component files, not shell heredocs
- Use `vision_analyze` for side-by-side visual QA against original screenshots
