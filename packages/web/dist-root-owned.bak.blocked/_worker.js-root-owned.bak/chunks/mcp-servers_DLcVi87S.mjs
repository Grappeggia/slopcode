globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./mcp-servers_C7I7PRC_.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
