# Operator setup: the steps this repo's automation cannot do itself

Everything else in this repo — build, test, Storybook, CI, versioning —
is fully automated. These steps need a human (two of them need a real npm
account with 2FA), and only need to happen once.

## 1. First publish (manual, interactive, one time only)

npm requires a package to already exist before a Trusted Publisher can be
configured for it — so the very first version has to go up the classic
way. **Build and verify before publishing** — `npm publish` on a fresh
clone with no build run would otherwise ship an empty package (`dist/` is
gitignored, and there's nothing to stop a clean checkout from having none
of it yet):

```bash
git clone https://github.com/OpenFASTER-Standard/ui.git
cd ui
pnpm install
cd packages/ui
pnpm build

# Confirm the tarball actually contains dist/, README.md, and LICENSE
# before publishing -- this is the one irreversible step in the whole
# project (npm does not allow republishing a version number).
npm pack --dry-run

npm login   # as sigalor, with 2FA
npm publish --access public
```

(`prepublishOnly` already runs `pnpm build` automatically as a second
safety net, but running it explicitly first lets you inspect the tarball
with `npm pack --dry-run` before the irreversible step.)

Expected: `@openfaster-standard/ui@0.1.0` (or whatever version
`package.json` currently has) appears at
https://www.npmjs.com/package/@openfaster-standard/ui, with `dist/`,
`README.md`, and `LICENSE` all present in its "Files" tab.

## 2. Configure npm Trusted Publishing (one time only)

1. Go to https://www.npmjs.com/package/@openfaster-standard/ui/access
2. Under "Trusted Publisher", add a new GitHub Actions publisher:
   - Organization/user: `OpenFASTER-Standard`
   - Repository: `ui`
   - Workflow filename: `release.yml`
   - Environment: (leave blank unless one is later added to `release.yml`)
3. Save.

From this point on, `.github/workflows/release.yml` can publish new
versions on its own via OIDC — no `NPM_TOKEN` secret, nothing to rotate.
Every subsequent release goes through a normal Changesets PR merge, not
a manual step. Note `release.yml` only runs after `ci.yml` completes
successfully on `main` (it's triggered by CI's own `workflow_run`
completion, not directly by the push) — a merge that breaks tests never
reaches the publish step.

## 3. Enable GitHub Pages (one time only)

`.github/workflows/storybook.yml` deploys the Storybook catalogue to
GitHub Pages on every push to `main`, but GitHub Pages itself needs to be
switched on first:

1. Go to https://github.com/OpenFASTER-Standard/ui/settings/pages
2. Under "Build and deployment" → "Source", select **GitHub Actions**
   (not "Deploy from a branch").

Once enabled, the deployed catalogue appears at
https://openfaster-standard.github.io/ui/ after the next successful run
of `storybook.yml`.
