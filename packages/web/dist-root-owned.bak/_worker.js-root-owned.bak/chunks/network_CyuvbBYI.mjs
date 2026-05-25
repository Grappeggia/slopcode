globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./network_CDLw2vVf.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
