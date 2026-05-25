globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./lsp_0xlAE6nz.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
