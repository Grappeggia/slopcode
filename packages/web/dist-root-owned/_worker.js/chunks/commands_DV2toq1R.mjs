globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./commands_Cyg6nEu6.mjs")
}
const collectedLinks = "@@ASTRO-LINKS@@"
const collectedStyles = "@@ASTRO-STYLES@@"
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
