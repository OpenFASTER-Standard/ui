// dist/style.css references Geist's woff2 files via relative url(./files/...)
// paths -- @tailwindcss/cli inlines the @font-face rules from
// @fontsource-variable/geist but does not copy the actual font assets, so
// without this step every consumer's browser 404s on all 5 font requests
// and silently falls back to the system sans-serif. Storybook's own Vite
// build handles this automatically (hence it never surfaced there), which
// is exactly why it went unnoticed until the published tarball was
// inspected directly.
import { cpSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)
const fontsourcePackageJson = require.resolve("@fontsource-variable/geist/package.json")
const filesDir = path.join(path.dirname(fontsourcePackageJson), "files")
const destDir = path.resolve(import.meta.dirname, "../dist/files")

if (!existsSync(filesDir)) {
  throw new Error(`@fontsource-variable/geist's files/ directory not found at ${filesDir}`)
}

cpSync(filesDir, destDir, { recursive: true })
console.log(`Copied Geist font files to ${destDir}`)
