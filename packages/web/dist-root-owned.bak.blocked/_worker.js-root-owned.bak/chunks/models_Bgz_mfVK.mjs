globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./models_CY1ucjAW.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
