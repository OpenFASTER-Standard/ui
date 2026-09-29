# npm publishing automation

This repo publishes to npm and deploys its Storybook catalogue with no
manual steps left for a human operator, and no standing npm credential
anywhere. This file used to be a setup checklist; it's now a record of
how that automation works, for whoever next needs to touch it.

## How it works

`@openfaster-standard/ui` is published via npm's **Trusted Publishing**
(OIDC) — `release.yml` has `permissions: id-token: write` and no npm
credential at all. Every publish is authenticated by a short-lived
identity assertion from the GitHub Actions runner itself, verified
against the trust relationship configured on the npm side (org
`OpenFASTER-Standard`, repo `ui`, workflow `release.yml`, permissions
`publish, stage publish`) — confirm with `npm trust list
@openfaster-standard/ui`. Nothing is stored, nothing expires, nothing
needs rotating.

## The account behind it

Publishing (and any future changes to the trust config) runs as a
dedicated npm account, `openfaster-standard-bot`, that `cloud-admin-box`
controls — not a human's personal npm account. Credentials live in
Vaultwarden's Divizend org ("cloud-admin-box: npm openfaster-standard-bot
account" item):

- Email is the `openfaster@divizend.com` Google Group (members mirror
  `cloud-admin-box@divizend.com`), readable via `scratch
  listGmailMessagesDetailed` — used to complete email-OTP challenges
  during plain password logins.
- **2FA is a real WebAuthn security key**, not TOTP — npm removed TOTP
  enrollment for new accounts. The passkey itself lives in the same
  Vaultwarden org item (`login.fido2Credentials`), not on any individual's
  device — Bitwarden's real browser extension, driven headlessly via
  Playwright, acts as the actual FIDO2 authenticator for both enrollment
  and every later assertion. The driver lives in its own repo,
  [`divizend/misc/webauthn-relay`](git@internal-gitlab.default.svc.cluster.local:divizend/misc/webauthn-relay.git)
  (cloned to `/work/webauthn-relay` on `cloud-admin-box`) — see its
  README for the exact driving pattern (a Chromium extension loaded via
  `--load-extension`, logged into the self-hosted Vaultwarden server,
  intercepting real `navigator.credentials` calls) — this is a general
  capability, reusable for any future service that gates a privileged
  action behind WebAuthn, not specific to npm or this repo.
- Any npm CLI action that needs live verification (`npm trust`, `npm
  token revoke`, an interactive `npm login`) prints a
  `https://www.npmjs.com/auth/cli/<id>` URL and waits — **run it with a
  real TTY, not piped through `tee`/similar, or npm silently skips the
  auto-browser-open path and falls back to a plain, unusable `Enter
  OTP:` text prompt.** Open the printed URL in the webauthn-relay
  browser to complete it.
- No npm token of any kind exists for this account — the one used to
  bootstrap the first publish (a `--bypass-2fa` granular token, back
  when the account had no real 2FA yet) was revoked once Trusted
  Publishing was configured. npm is phasing out that kind of token
  anyway (bypass-2FA tokens lost account-management rights 2026-07-31,
  and lose direct publish entirely around 2027-01) — it was only ever a
  bootstrap stopgap, never the destination.

## GitHub Pages

Already enabled (`gh api repos/OpenFASTER-Standard/ui/pages -X POST -f
"build_type=workflow"`) — `storybook.yml` deploys to
https://openfaster-standard.github.io/ui/ on every push to `main`.
