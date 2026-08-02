globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./formatters_CL9o_QDX.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
