globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./config_Cy1l62UV.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
