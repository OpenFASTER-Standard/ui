---
"@openfaster-standard/shapes": patch
---

Add the `LICENSE` and `README.md` this package's own `package.json` already
declared (`"license": "MIT"`, `"files": ["dist", "README.md"]`) but never
shipped, and wire this package into the release workflow so it actually
gets published.
