---
"@openfaster-standard/ui": minor
---

Fixes from a 2026-09-29 architectural-fitness audit:

- Fix `AccordionContent`: a passed `className` now lands on the actual `data-slot="accordion-content"` element instead of a slot-less inner div.
- Fix the `"use client"` directive: applied once via a build banner (it was previously silently dropped from the bundled output entirely, since neither per-file directive survived bundling).
- Export `cn` from the package, so consumers composing their own components on top of this library share the exact same class-merge behavior.
- Add `cardVariants` (a real `cva`), matching `buttonVariants`/`badgeVariants` — `Card`'s `size` prop is now discoverable via `VariantProps` like every other variant-bearing component's.
- `Alert`'s `variant` prop now defaults to `"default"` explicitly, matching `Button`/`Badge`.
- Fix `skeleton.tsx`'s missing `React` import (previously relied on the ambient global namespace).
