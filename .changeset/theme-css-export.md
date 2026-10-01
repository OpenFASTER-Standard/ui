---
"@openfaster-standard/ui": minor
---

Newly exported: `@openfaster-standard/ui/theme.css` -- the package's real
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
