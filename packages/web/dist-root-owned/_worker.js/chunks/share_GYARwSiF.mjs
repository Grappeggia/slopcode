globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./share_C6HMqZG1.mjs")
}
const collectedLinks = "@@ASTRO-LINKS@@"
const collectedStyles = "@@ASTRO-STYLES@@"
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
