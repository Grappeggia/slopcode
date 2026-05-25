globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./modes_e7CeM2mB.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
