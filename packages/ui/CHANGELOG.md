# @openfaster-standard/ui

## 0.4.1

### Patch Changes

- 6e2c449: `theme.css`'s own imports (`tw-animate-css`, `shadcn/tailwind.css`,
  `@fontsource-variable/geist`) are now real `dependencies`, not
  devDependencies-only -- confirmed live during workspace-auth's own first
  consumption of theme.css: the build failed outright with "Can't resolve
  'tw-animate-css'" since an external consumer only gets `dependencies`
  installed transitively, never this package's own devDependencies.

## 0.4.0

### Minor Changes

- eeb51f8: Newly exported: `@openfaster-standard/ui/theme.css` -- the package's real
  Tailwind source (its `@import "tailwindcss"` + `@theme`/`:root`/`.dark`
  variable definitions), not pre-generated utility output. `./style.css`
  remains a complete, pre-compiled stylesheet covering every class this
  package's own components render -- but it was Tailwind-scanned only
  against this package's own source, so a utility class a consuming app
  writes in its own code (e.g. `max-w-2xl` in a layout container) was never
  seen by that build and silently has zero effect. A consumer that wants its
  own layout classes to work imports `theme.css` into its own Tailwind entry
  point and runs its own Tailwind build (scanning its own source) alongside
  the existing `style.css` import for component-internal styles.

## 0.3.0

### Minor Changes

- 25084f8: Fixes from a 2026-09-29 architectural-fitness audit:
  
  - Fix `AccordionContent`: a passed `className` now lands on the actual `data-slot="accordion-content"` element instead of a slot-less inner div.
  - Fix the `"use client"` directive: applied once via a build banner (it was previously silently dropped from the bundled output entirely, since neither per-file directive survived bundling).
  - Export `cn` from the package, so consumers composing their own components on top of this library share the exact same class-merge behavior.
  - Add `cardVariants` (a real `cva`), matching `buttonVariants`/`badgeVariants` — `Card`'s `size` prop is now discoverable via `VariantProps` like every other variant-bearing component's.
  - `Alert`'s `variant` prop now defaults to `"default"` explicitly, matching `Button`/`Badge`.
  - Fix `skeleton.tsx`'s missing `React` import (previously relied on the ambient global namespace).

## 0.2.0

### Minor Changes

- ad0c011: Add Accordion component
