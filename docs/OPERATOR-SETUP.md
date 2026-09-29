# npm publishing automation

This repo publishes to npm and deploys its Storybook catalogue with no
manual steps left for a human operator. This file used to be a setup
checklist; it's now a record of how that automation works, for whoever
next needs to touch it.

## How it works

`@openfaster-standard/ui` is published by a dedicated npm account,
`openfaster-standard-bot`, that `cloud-admin-box` controls (not a human's
personal npm account). Credentials live in Vaultwarden's Divizend org
("cloud-admin-box: npm openfaster-standard-bot account" item), including
why they're shaped the way they are:

- npm removed TOTP 2FA enrollment for new accounts (WebAuthn/security-key
  only now), so this account can't hold a standing TOTP secret the way
  other box-controlled accounts do. 2FA is left off; privileged actions
  challenge a one-time email OTP instead, which the box can read and
  relay itself via `openfaster@divizend.com` (a Google Group, readable
  through `scratch listGmailMessagesDetailed`).
- `release.yml` publishes using a **granular access token** (scope
  `@openfaster-standard`, read-write, `--bypass-2fa`), stored as the
  `NPM_TOKEN` GitHub Actions secret on this repo. `changesets/action`
  uses `NPM_TOKEN` directly when present, no OIDC involved.
- **This token expires 90 days after creation** (npm's cap for
  read-write granular tokens) and must be rotated before then via
  `npm token create ... --bypass-2fa --expires 90`, updating both the
  GitHub secret (`gh secret set NPM_TOKEN --repo OpenFASTER-Standard/ui`)
  and the Vaultwarden item.
- Trusted Publishing (OIDC) was the original design but turned out to
  require genuine WebAuthn 2FA on the publishing account for the
  `npm trust` configuration step specifically — bypass-2FA tokens are
  explicitly rejected for that one action. Building a software WebAuthn
  authenticator to clear that bar was judged out of scope; the token+secret
  approach above achieves the same automated outcome without it.

## GitHub Pages

Already enabled (`gh api repos/OpenFASTER-Standard/ui/pages -X POST -f
"build_type=workflow"`) — `storybook.yml` deploys to
https://openfaster-standard.github.io/ui/ on every push to `main`.
