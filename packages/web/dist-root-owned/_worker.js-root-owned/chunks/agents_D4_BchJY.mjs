globalThis.process ??= {}
globalThis.process.env ??= {}
async function getMod() {
  return import("./agents_eITo6gVr.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
