---
"@openfaster-standard/ui": patch
---

`theme.css`'s own imports (`tw-animate-css`, `shadcn/tailwind.css`,
`@fontsource-variable/geist`) are now real `dependencies`, not
devDependencies-only -- confirmed live during workspace-auth's own first
consumption of theme.css: the build failed outright with "Can't resolve
'tw-animate-css'" since an external consumer only gets `dependencies`
installed transitively, never this package's own devDependencies.
