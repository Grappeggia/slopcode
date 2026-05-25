globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./permissions_W3K_lYg6.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
