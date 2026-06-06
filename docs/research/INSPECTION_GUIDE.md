# Website Inspection Guide (Hermes Agent)

## How to Reverse-Engineer Any Website

Use Hermes `browser_*` tools to extract everything from the target site.

## Phase 1: Visual Audit

### Screenshots to Capture
- [ ] Desktop (1440px) — full page
- [ ] Mobile (390px) — full page
- [ ] Key interaction states (hover, active, open menus, modals)
- [ ] Dark/light mode variants (if applicable)

### Design Tokens to Extract
- [ ] **Colors** — background, text, accent, border, hover, error, success, warning
- [ ] **Typography** — font family, sizes (h1-h6, body), weights, line heights
- [ ] **Spacing** — padding/margin patterns (look for scale: 4, 8, 12, 16, 24, 32px)
- [ ] **Border radius** — buttons, cards, inputs
- [ ] **Shadows** — card shadows, dropdown, modal overlay
- [ ] **Breakpoints** — when does layout shift?

## Phase 2: Component Inventory

For each component document:
1. Name, structure, variants, states
2. Responsive behavior at each breakpoint
3. Interactions (click, hover, focus)
4. Animations and transitions

## Phase 3: Layout Architecture

- Grid system (CSS Grid / Flexbox / fixed widths)
- Column layout per breakpoint
- Max-width, sticky elements, z-index layers
- Scroll behavior (infinite, pagination, snap)

## Phase 4: Technical Stack

- Framework detection (`__NEXT_DATA__`, `__NUXT__`)
- CSS approach (Tailwind, CSS Modules, styled-components)
- State management (Redux, Zustand, React Query)
- Font loading strategy
- Animation library (Framer Motion, GSAP, CSS transitions)

## Phase 5: Documentation Output

Create in `docs/research/`:
1. `DESIGN_TOKENS.md` — colors, typography, spacing
2. `COMPONENT_INVENTORY.md` — every component with structure
3. `LAYOUT_ARCHITECTURE.md` — page layouts, grid, responsive
4. `INTERACTION_PATTERNS.md` — animations, transitions, hover states
5. `TECH_STACK_ANALYSIS.md` — what site uses, our equivalents
