globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./modes_BPas6sHG.mjs")
}
const collectedLinks = "@@ASTRO-LINKS@@"
const collectedStyles = "@@ASTRO-STYLES@@"
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
