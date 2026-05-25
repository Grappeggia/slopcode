globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./formatters_D0o-Ymlt.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
