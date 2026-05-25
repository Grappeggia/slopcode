globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./zen_C1_3qOa9.mjs")
}
const collectedLinks = "@@ASTRO-LINKS@@"
const collectedStyles = "@@ASTRO-STYLES@@"
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
