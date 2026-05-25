globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./custom-tools_CYcXp13U.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
