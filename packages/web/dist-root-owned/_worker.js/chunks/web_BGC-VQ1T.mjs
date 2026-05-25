globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./web_DT3rY2ng.mjs")
}
const collectedLinks = "@@ASTRO-LINKS@@"
const collectedStyles = "@@ASTRO-STYLES@@"
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
