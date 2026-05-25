globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./cli_CuF_3BsG.mjs")
}
const collectedLinks = "@@ASTRO-LINKS@@"
const collectedStyles = "@@ASTRO-STYLES@@"
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
