// jsdom's own window.crypto has no .subtle at all (confirmed live) --
// vitest's jsdom environment makes this the global `crypto` tests see,
// which would otherwise break computeContentHash for a reason that has
// nothing to do with the implementation. Production code itself just
// references the ambient global crypto.subtle, which already works
// natively in both a real browser and plain Node with no import needed.
import { webcrypto } from "node:crypto"
import { vi } from "vitest"

vi.stubGlobal("crypto", webcrypto)
