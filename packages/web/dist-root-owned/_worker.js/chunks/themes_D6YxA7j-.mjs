globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./themes_B6E0G3L-.mjs")
}
const collectedLinks = "@@ASTRO-LINKS@@"
const collectedStyles = "@@ASTRO-STYLES@@"
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
