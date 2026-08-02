globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./acp_C-3EZzo_.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
