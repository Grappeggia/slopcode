globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./models_qBa0M2fn.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
