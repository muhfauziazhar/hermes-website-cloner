# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-06

### Added
- Initial template — Next.js 15 + React 19 + TypeScript strict
- shadcn/ui (@base-ui/react primitives) + Tailwind CSS v4 with oklch design tokens
- `clone-website` Hermes skill — 5-phase pipeline (recon → foundation → spec → parallel build → QA)
- `scripts/download-assets.mjs` — batched asset downloader (4 concurrent, retry, manifest-driven)
- Docker support (multi-stage production build + dev compose service)
- CI workflow (lint + typecheck + build on push/PR)
- LICENSE (MIT) with attribution to upstream ai-website-cloner-template
- `.nvmrc`, `.dockerignore`, INSPECTION_GUIDE.md

### Fixed
- ESLint flat config now compatible with Next.js 15 (`FlatCompat` + `@eslint/eslintrc`);
  previously used Next 16-only subpath imports that broke `npm run lint`
- Aligned Next.js version references across README and AGENTS.md (was inconsistently labeled 16)
