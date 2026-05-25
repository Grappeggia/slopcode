globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./skills_CaKX2Y3K.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
