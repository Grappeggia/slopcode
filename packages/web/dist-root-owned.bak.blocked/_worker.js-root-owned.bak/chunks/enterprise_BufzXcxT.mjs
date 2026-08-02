globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./enterprise_B3z_R0wa.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
