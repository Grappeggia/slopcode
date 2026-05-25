globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./zen_Dbw22f3o.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
