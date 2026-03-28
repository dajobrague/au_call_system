# OnCallAfterHours Marketing Site

Static marketing website built with **Astro**, **React** (islands), **TailwindCSS**, and **shadcn/ui** components.

## Quick Start

```bash
# From the marketing-site/ directory
npm install
npm run dev          # → http://localhost:4321

# Or from the repo root
cd marketing-site && npm install && npm run dev
```

## Scripts

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start Astro dev server (port 4321)       |
| `npm run build`     | Type-check + production build            |
| `npm run preview`   | Preview the production build locally     |
| `npm run check`     | Run `astro check` (TypeScript)           |
| `npm run lint`      | Run ESLint                               |

## Project Structure

```
src/
├── components/
│   ├── ui/            React components (shadcn/ui — Button, Card, Badge)
│   ├── layout/        Astro primitives (Container, Section, Stack, Grid)
│   ├── typography/    Astro type helpers (H1, H2, H3, Lead, Muted)
│   └── common/        Astro shared (Header, Footer, Logo, Nav, CTA, StatusBanner)
├── layouts/
│   └── BaseLayout.astro   HTML shell with SEO meta + OG tags
├── pages/                 File-based routing
├── styles/
│   ├── globals.css        Tailwind directives + CSS custom properties (theme)
│   └── theme.ts           Typed token exports for JS usage
└── lib/
    └── utils.ts           cn() helper
```

## Editing Theme Tokens

Brand colors, radii, and font are defined in two places that must stay in sync:

1. **`src/styles/globals.css`** — CSS custom properties under `:root`. These drive all Tailwind utilities via `tailwind.config.mjs`.
2. **`src/styles/theme.ts`** — TypeScript mirror of the same values for programmatic use (charts, dynamic styles, etc.).

To change the brand palette, update the HSL values in both files. The format is `H S% L%` (without the `hsl()` wrapper — Tailwind adds it automatically).

## Adding New Sections

1. Create a new `.astro` component in `src/components/` (use `layout/` primitives for structure).
2. Import and place it in the relevant page file under `src/pages/`.
3. For interactive widgets, create a React component in `src/components/ui/` and use `client:load` or `client:visible` to hydrate.
4. Keep marketing copy in Astro files, not in React components.

## Adding New Pages

Create a new `.astro` file in `src/pages/`. It will automatically become a route matching the filename. Use `BaseLayout` as the wrapper:

```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
---

<BaseLayout title="Page Title" description="Meta description">
  <!-- page content -->
</BaseLayout>
```

## Tech Stack

- **Astro 4** — Static site generator
- **React 19** — Interactive islands only
- **Tailwind CSS 3.4** — Utility-first styling
- **shadcn/ui** — React component primitives (Button, Card, Badge)
- **lucide-react** — Icon library
- **TypeScript 5** — Strict mode
# oncall-site
