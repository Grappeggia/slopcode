globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./plugins_B3h4-7n7.mjs")
}
const collectedLinks = "@@ASTRO-LINKS@@"
const collectedStyles = "@@ASTRO-STYLES@@"
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
