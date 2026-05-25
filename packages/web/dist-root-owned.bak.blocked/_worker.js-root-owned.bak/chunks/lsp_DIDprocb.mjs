globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./lsp_sBpKO3z6.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
