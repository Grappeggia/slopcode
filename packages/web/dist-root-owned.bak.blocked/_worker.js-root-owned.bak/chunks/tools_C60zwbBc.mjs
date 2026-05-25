globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./tools_CISCc907.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
