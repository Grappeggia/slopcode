globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./sdk_SV1BPVPO.mjs")
}
const collectedLinks = "@@ASTRO-LINKS@@"
const collectedStyles = "@@ASTRO-STYLES@@"
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
