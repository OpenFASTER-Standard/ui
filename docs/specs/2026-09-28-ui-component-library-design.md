# OpenFASTER UI Component Library — Design

## Context

`OpenFASTER-Standard/generator`'s webapp (a FastAPI + vanilla-JS static
page) grew a 3rd view during `citation-workflow` and is about to grow a
4th (drift-review). Rather than keep hand-rolling vanilla-JS UI as each
new OpenFASTER tool needs one, this project builds the shared,
professionally-built, genuinely reusable component library those tools
draw from -- not scoped to `generator` alone, but to the whole OpenFASTER
ecosystem, current and future.

This repo (`OpenFASTER-Standard/ui`) is deliberately separate from
`generator` (a different GitHub repo, under the same `OpenFASTER-Standard`
org, not Divizend's own `app` monorepo -- OpenFASTER is a genuinely open,
multi-tool ecosystem, not a single internal app with a feature bolted on).
It is judged and built entirely on its own; `generator`'s own rebuild onto
it is a separate, later sub-project that designs against this repo's real,
finished output.

An earlier attempt at a `generator`-specific React/shadcn/Base-UI frontend
(`generator`'s now-superseded Plan D / `2026-09-17-interconnected-provenance-ui`)
was built, then deleted along with the rest of an unrelated data-model
reset -- not because that tech stack itself failed. This project revives
the same tech choices (shadcn's generator pointed at Base UI, Tailwind),
but as a real, standalone, publishable package instead of a per-app copy.

## Goal

Publish `@openfaster-standard/ui` to the public npm registry: a real,
versioned, importable React component library (not a copy-paste-per-repo
template), catalogued in Storybook, seeded with the ~12 real components
`generator`'s existing + planned webapp views actually need. Every
technical claim below was verified live in this repo before being written
down (see "What was verified live" at the end) -- this is not a plan
written from memory or assumption.

## Non-Goals

- Building or migrating `generator`'s webapp onto this library -- that is
  the next, separate sub-project, which designs against this repo's real,
  tagged v0.1.0 output, not a moving target.
- A component for every shadcn/Base-UI primitive that exists -- only the
  ~12 real components enumerated below, grounded in `generator`'s actual
  current + planned views. More get added by later consumers' own real
  need, the same way these were chosen.
- Turborepo, or any multi-package build orchestration -- there is exactly
  one real package (`packages/ui`) plus its Storybook catalogue today.
  Adding Turborepo later, if the repo grows more packages, is a cheap,
  non-breaking addition -- not worth the complexity now.
- A design-token/theming system beyond what shadcn's own `nova` preset and
  Tailwind's CSS-variable-based theming already provide out of the box.
- Dark mode, i18n/RTL, or any other cross-cutting concern beyond what the
  chosen preset ships with by default -- these become real, scoped
  follow-ups if and when a real consumer needs them.

## Tech stack (every choice verified live in this repo)

- **Package manager:** pnpm (v12.6.0 on this box), plain workspaces
  (`pnpm-workspace.yaml` naming `packages/*`) -- no Turborepo yet, see
  Non-Goals.
- **Language:** TypeScript, `strict: true`. **Verified: this box's
  `typescript@latest` is 7.0.2**, a real, current stable release (not a
  preview) -- meaningfully newer than the 5.x line most current tooling
  (including `tsup`'s own `dts` generation, see below) still assumes.
  TS 7 is also stricter about `rootDir` inference than 5.x was
  (`TS5011: The common source directory ... rootDir must be explicitly
  set`) -- confirmed live, fixed by setting `rootDir: "src"` explicitly.
- **Component primitives:** [Base UI](https://base-ui.com) (`@base-ui/react`,
  **verified real, current version 1.8.0** -- not `@base-ui-components/react`,
  the deleted Plan D's package name, which still exists on npm but is
  stale at `1.0.0-rc.0` and was renamed/superseded by `@base-ui/react`).
  Headless/unstyled, accessible by construction.
- **Component generation:** the `shadcn` CLI (**verified real, current
  version 4.21.0**) pointed at Base UI via `-b base -p nova` (the `nova`
  preset -- Lucide icons, Geist font -- matching the deleted Plan D's own
  choice). **Verified live**: `shadcn init` requires a detectable
  framework (it refuses to run against a bare library package with no
  bundler config: `"We could not detect a supported framework"`) -- fixed
  by giving `packages/ui` its own `vite.config.ts` (using
  `@tailwindcss/vite` + `@vitejs/plugin-react`) purely so the CLI's
  framework detection succeeds; this same `vite.config.ts` is not used to
  build the distributable package (that's `tsup`'s job, below) but *is*
  reused by Storybook's own Vite-based dev server, so it earns its keep
  twice, not once for CLI detection alone.
  - **Verified, real, reproduced gotcha (matches a gotcha the deleted Plan
    D already hit once)**: the CLI resolves the `@/` import alias from the
    **root** `tsconfig.json`'s own `compilerOptions.paths` -- declaring the
    alias in a nested/included tsconfig only is not enough; without it in
    the root file, `shadcn add` silently writes components into a literal
    `./@/...` directory instead of `./src/...`. Reproduced live (got the
    literal `@/components/ui/button.tsx` bug, fixed it by adding
    `paths: {"@/*": ["./src/*"]}` directly to the root `tsconfig.json`).
  - **Verified, current fact (a change since the deleted Plan D was
    written)**: `shadcn` no longer generates a hand-rolled `cn()` helper
    into `src/lib/utils.ts` -- it now depends on a real, separately
    published `cn` npm package and `utils.ts` is just
    `export { cn } from "cn"`. Not a design choice this project is making,
    just what the current CLI actually does.
- **Styling:** Tailwind CSS v4 (**verified real, current version 4.3.3**),
  compiled into a single shipped stylesheet, not left as a Tailwind
  dependency for every consumer to configure (see "Styling: compiled CSS,
  not consumer-configured Tailwind" below). **Verified live**: the
  standalone `@tailwindcss/cli` package compiles `src/index.css`
  (containing just `@import "tailwindcss";`) into a real, complete,
  scanned-from-source stylesheet with no bundler involved --
  `tailwindcss -i ./src/index.css -o ./dist/style.css --minify` is a real,
  working, one-line build step.
- **Library build:** `tsup` (**verified real, current version 8.5.1**)
  for ESM + CJS JS output. **Verified live, real, current tooling gap**:
  `tsup`'s built-in `dts: true` (via `rollup-plugin-dts`) crashes against
  TypeScript 7 (`TypeError: Cannot read properties of undefined (reading
  'useCaseSensitiveFileNames')`) -- `rollup-plugin-dts` hasn't caught up
  to TS 7's compiler API yet. Fixed by decoupling: `tsup` builds JS only
  (`dts: false`), and a separate `tsc --emitDeclarationOnly --declaration
  --outDir dist` pass (run directly against the same `tsconfig.json`)
  produces the `.d.ts` files. Verified this combination actually produces
  a correct, complete `dist/` (`index.js`, `index.cjs`, `index.d.ts`, plus
  per-component nested `.d.ts` files).
  - **Verified, real `package.json` `exports` gotcha**: esbuild (via
    `tsup`) warns if the `"types"` condition in an `exports` map entry
    comes *after* `"import"`/`"require"` -- Node's own resolution order
    means a later `"types"` key is silently ignored. Fixed by always
    listing `"types"` first in every conditional exports block.
- **CSS delivery: `./style.css` as a real `exports` subpath** --
  `import "@openfaster-standard/ui/style.css"` -- pointing at the
  `tailwindcss`-CLI-compiled `dist/style.css` above.
- **Catalogue:** Storybook (**verified real, current version 8.5.1**,
  `@storybook/react-vite` framework, `@storybook/addon-a11y` for
  accessibility checks given Base UI's own accessibility focus).
  **Verified live**: `storybook init` scaffolds real example stories and
  a real `.storybook/main.ts`/`preview.ts`; a real story written against
  this project's own generated `Button` component, importing the
  compiled `src/index.css` in `preview.ts` (so components render with
  real Tailwind styles applied, not unstyled), builds successfully via
  `storybook build` into a real `storybook-static/` bundle -- confirmed,
  not assumed.
- **Testing:** Vitest + React Testing Library, one test file per
  component (matches the deleted Plan D's own precedent for this pairing).
- **License:** MIT, matching `generator`'s own license (the org's other
  code repo -- `ontologies`/`showcase` use CC-BY-4.0, correctly, since
  those are data/content repos, not code).

## Styling: compiled CSS, not consumer-configured Tailwind

shadcn's own default pattern expects the *consuming app* to have Tailwind
configured, scanning the library's source files via a content glob. That
couples every future OpenFASTER tool to adopting Tailwind itself just to
use one component -- a real cost against this project's explicit goal of
being the foundational UI for tools not yet imagined. Instead, Tailwind
runs entirely inside this package's own build (verified above) and ships
one compiled `dist/style.css` a consumer imports once, with zero Tailwind
configuration of their own required. The real cost: a consumer can't
reach in and override with arbitrary Tailwind utility classes as fluidly
as the classic pattern allows -- acceptable, since Base UI's own styling
hooks (`className`, CSS variables the `nova` preset already exposes) still
allow real customization without that coupling.

## Repo structure

```
OpenFASTER-Standard/ui/
  packages/
    ui/                       <- the publishable @openfaster-standard/ui package
      src/
        components/ui/        <- shadcn/Base-UI-generated components (owned source)
        lib/utils.ts           <- `export { cn } from "cn"` (current shadcn convention)
        index.ts               <- public exports
        index.css               <- `@import "tailwindcss";` (compiled at build time)
      dist/                   <- build output (gitignored): index.js, index.cjs,
                                   index.d.ts, style.css
      package.json
      tsconfig.json           <- paths at root level (shadcn CLI gotcha, see above)
      tsup.config.ts
      vite.config.ts          <- for shadcn CLI framework detection + Storybook only
      components.json         <- shadcn CLI config (style: base-nova)
  .storybook/
    main.ts
    preview.ts
  .github/workflows/
    ci.yml                    <- lint/typecheck/test/build/storybook-build on every PR
    storybook.yml             <- deploy Storybook to GitHub Pages on merge to main
    release.yml               <- Changesets-driven version/publish, npm Trusted Publishing (OIDC)
  pnpm-workspace.yaml
  README.md
  LICENSE (MIT)
```

## Initial component set

Grounded in `generator`'s real, already-built 3 views (index, page-detail,
add-citation) and its real, already-designed 4th (drift-review) -- not
speculative coverage of shadcn's full catalog:

| Component | Real need |
|---|---|
| Button | every action: submit, cite this, approve/reject |
| Table | pages index, revision history, candidate list, flagged-drift list |
| Badge | `.correction` marker, drift-kind (CONTENT/STRUCTURAL), verdict (approved/rejected) |
| Input | fact key, author, comment fields |
| Checkbox | is-correction toggle |
| Label | every form field |
| Textarea | review reasoning (longer than a single-line comment) |
| Form | wraps the citation/review submission forms, field-level validation display |
| Alert | replaces the current `#error`/`#empty` ad hoc states |
| Card | groups a page's/candidate's summary content |
| Skeleton | replaces the current bare "Loading..." text |
| Dialog | the citation/review submission forms, as a proper modal instead of an inline block |

## Publishing

- **Scope:** `@openfaster-standard/ui` -- exact match to the GitHub org
  name, per real precedent (`@testing-library` for GitHub org
  `testing-library`, `@open-wc` for `open-wc`).
- **Ownership:** the `openfaster-standard` npm Organization (already
  created by the operator, confirmed live via the registry:
  `GET /-/org/openfaster-standard/user` returns `{}`, not a 404 -- a real,
  registered org, not yet populated with team members).
- **First publish:** manual, interactive, under a real npm account with
  2FA (`sigalor`) -- this is the one step in this whole project that
  cannot be automated or done from this box, because npm requires an
  already-published package to exist before a Trusted Publisher can be
  configured for it, and the initial `npm login`/2FA prompt needs a human.
  This plan's last task ends with instructions for the operator to run
  this manually.
- **CI publishing thereafter:** npm's OIDC-based **Trusted Publishing**,
  not a long-lived `NPM_TOKEN` secret. This isn't just the nicer choice --
  npm revoked all classic tokens in December 2025 and is removing
  bypass-2FA granular tokens entirely by January 2027, so a classic-token
  setup started today is already on a deprecation clock. Trusted
  Publishing needs `permissions: id-token: write` in the release workflow,
  npm CLI ≥ 11.5.1, `actions/setup-node@v6`, and a Trusted Publisher entry
  configured on npmjs.com naming this repo's exact release workflow file
  -- configured by the operator, after the manual first publish above,
  pointing at `.github/workflows/release.yml`.
- **Versioning:** Changesets -- each PR that changes `packages/ui` adds a
  changeset describing the change; a release PR batches pending
  changesets into a version bump + changelog; merging it triggers
  `release.yml`.

## Testing strategy

- Every component gets a Vitest + React Testing Library test asserting
  its real rendered behavior (e.g. `Button` renders its children, forwards
  `onClick`; `Badge` applies the right variant class; `Dialog` opens/closes).
- Every component gets a Storybook story covering its real variants (not
  just a default render) -- these double as living documentation and a
  manual visual-QA surface.
- `pnpm build` (tsup + tsc + tailwindcss CLI) must succeed with a real,
  inspectable `dist/` as the CI gate -- verified live in this repo that
  this exact combination produces working ESM/CJS/types/CSS output.
- `pnpm build-storybook` must succeed as a separate CI gate -- verified
  live that this exact combination produces a real, working static bundle.

## Definition of Done

- [ ] `packages/ui` builds cleanly (`tsup` + `tsc --emitDeclarationOnly` +
      `tailwindcss` CLI), producing `dist/index.js`, `dist/index.cjs`,
      `dist/index.d.ts`, `dist/style.css`.
- [ ] All 12 components listed above exist, each with a passing Vitest
      test and a Storybook story with real variants.
- [ ] `pnpm build-storybook` succeeds; CI deploys it to GitHub Pages on
      merge to `main`.
- [ ] CI (`ci.yml`) runs lint/typecheck/test/build on every PR.
- [ ] `release.yml` exists, configured for Changesets + npm Trusted
      Publishing, and is documented as not-yet-runnable until the
      operator's manual first publish + Trusted Publisher configuration
      (both explicitly out of this project's own automation, see
      Publishing above).
- [ ] `v0.1.0` is tagged once the above is true, giving `generator`'s own
      rebuild sub-project a real, stable version to design against.

## Roadmap: what this enables next

- **`generator`'s webapp rebuild** onto `@openfaster-standard/ui`,
  replacing all 3 existing vanilla-JS views and adding the drift-review
  view as the 4th -- a separate sub-project, designed against this repo's
  real `v0.1.0` output, not a hypothetical API. Concludes with a deep
  architectural-fitness audit across the whole result (both repos), fixing
  every finding regardless of severity.
- **Turborepo**, if/when a second real package joins this repo.
- **More components**, added the same way these 12 were chosen: a real,
  current consumer's real, current need -- never spec'd speculatively
  ahead of one.

## What was verified live (summary, see inline citations above for detail)

Every version number, every gotcha, and every "this actually builds"
claim in this spec was reproduced directly in this repo before being
written down, then reverted (`git clean -ffdx` + `git checkout --
.gitignore`) so this spec is the only record of that work until the
implementation plan redoes it for real, task by task, with tests and
commits: pnpm 12.6.0; TypeScript 7.0.2 (a real, current stable, not a
preview) and its new `rootDir`-inference strictness; `@base-ui/react`
1.8.0 as the current, correct package name (not the stale, deleted-Plan-D-era
`@base-ui-components/react` 1.0.0-rc.0); `shadcn` CLI 4.21.0's `-b base
-p nova` flow, its framework-detection requirement, its root-`tsconfig.json`
alias-resolution gotcha, and its current `cn`-package-based (not
hand-rolled) `utils.ts` generation; Tailwind CSS 4.3.3 and its standalone
CLI compiling a real stylesheet with no bundler; `tsup` 8.5.1's real,
current incompatibility with TypeScript 7's `dts` generation, and the
`tsc --emitDeclarationOnly` workaround that actually produces a correct
`dist/`; the `package.json` `exports`-map ordering requirement; and
Storybook 8.5.1's `init`/`build` flow against this project's own real
generated component.
