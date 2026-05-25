globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./formatters_BzFk3kS3.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
