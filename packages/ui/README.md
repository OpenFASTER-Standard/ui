# @openfaster-standard/ui

Part of [OpenFASTER](https://openfaster.org). A shared React component
library built on [Base UI](https://base-ui.com) primitives, styled with
[Tailwind CSS](https://tailwindcss.com) compiled at build time -- you
never configure Tailwind yourself, just import the components and one
stylesheet.

Catalogued in Storybook: see this repo's own deployed catalogue (once
`storybook.yml` has run against `main`) for every component's real
variants.

## Install

```bash
npm install @openfaster-standard/ui
```

Requires React 19 or later (`react`/`react-dom` are peer dependencies --
this package never bundles its own copy, so it always runs against your
app's real React instance).

## Use

```tsx
import { Button } from "@openfaster-standard/ui"
import "@openfaster-standard/ui/style.css" // once, anywhere in your app's entry point

function Example() {
  return <Button variant="destructive">Delete</Button>
}
```

## The stylesheet is not scoped to just these components

`@openfaster-standard/ui/style.css` includes Tailwind's own Preflight
reset and this library's base theme -- importing it resets margins,
padding, heading sizes, and list styles across your **entire**
application, and sets your page's default `background`/`color`/`font`
from this library's own design tokens (light/dark, defined in
`src/index.css`).

This is a deliberate choice, not an oversight: the library is meant to be
the foundational UI for OpenFASTER tools built from scratch around it,
not a component picked up one-at-a-time inside an already-styled
application. If you're integrating into an app with its own existing
global styles, importing this stylesheet will visibly change your
existing typography and colors -- test it on a real page before shipping,
and if that's not what you want, don't import `style.css` and style
components with your own CSS/`className` overrides instead (every
component accepts `className` and merges it via `cn()`).

## License

MIT, see `LICENSE`.
