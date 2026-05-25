globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./network_BlEn48Iq.mjs")
}
const collectedLinks = "@@ASTRO-LINKS@@"
const collectedStyles = "@@ASTRO-STYLES@@"
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
