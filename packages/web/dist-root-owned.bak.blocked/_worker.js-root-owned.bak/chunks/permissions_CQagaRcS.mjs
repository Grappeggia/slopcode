globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./permissions_Bv2d1g_b.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
