globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./ecosystem_CiwtfVc5.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
