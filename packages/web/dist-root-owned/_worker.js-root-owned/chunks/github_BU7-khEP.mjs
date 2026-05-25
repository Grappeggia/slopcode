globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./github_Dij5J2hB.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
