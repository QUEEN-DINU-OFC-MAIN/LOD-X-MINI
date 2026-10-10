# Vendored WhatsApp library

Derived from:
- **Baileys** (WhiskeySockets) v7.0.0-rc14 — MIT, (c) 2025 Rajeh Taher/WhiskeySockets  → LICENSE-Baileys
- **chama-bailez-pro** 3.3.2 (CHAMA OFC) — MIT → LICENSE-chama-bailez-pro  (only `lib/Pro/*`, interactive/native-flow buttons, newsletter helpers)

Local modifications (see git history / README of the project):
1. Removed `lib/Caller/*` (WhatsApp VoIP WASM, wrtc, call recording), banner, auto-answer, `assets/`, `dist/`.
2. Removed `maxKeys` from every NodeCache. `@cacheable/node-cache` throws ECACHEFULL when the limit is hit,
   which aborted `makeCacheableSignalKeyStore.set()` BEFORE `store.set()` → Signal keys silently not persisted.
3. `lib/index.js` rewritten: no startup banner, no auto call-engine, no promo links.
4. Source maps and .d.ts files stripped.
There is NO automatic newsletter/channel follow anywhere in this tree (`newsletterFollow` is only an API method).
