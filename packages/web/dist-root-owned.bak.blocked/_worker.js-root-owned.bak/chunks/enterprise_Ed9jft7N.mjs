globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./enterprise_QV9WPS_b.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
