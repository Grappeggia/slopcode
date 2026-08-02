globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./providers_BVL2A7Pj.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
