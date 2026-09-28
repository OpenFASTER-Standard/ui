# Operator setup: the two steps this repo's automation cannot do itself

Everything else in this repo — build, test, Storybook, CI, versioning —
is fully automated. These two steps need a human with a real npm account
and 2FA, and only need to happen once.

## 1. First publish (manual, interactive, one time only)

npm requires a package to already exist before a Trusted Publisher can be
configured for it — so the very first version has to go up the classic
way.

```bash
cd packages/ui
npm login   # as sigalor, with 2FA
npm publish --access public
```

Expected: `@openfaster-standard/ui@0.1.0` (or whatever version
`package.json` currently has) appears at
https://www.npmjs.com/package/@openfaster-standard/ui.

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
a manual step.
