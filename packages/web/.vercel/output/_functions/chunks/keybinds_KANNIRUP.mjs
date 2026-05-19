async function getMod() {
  return import("./keybinds_DkMNDZSw.mjs")
}
const collectedLinks = []
const collectedStyles = []
const defaultMod = { __astroPropagation: true, getMod, collectedLinks, collectedStyles, collectedScripts: [] }

export { defaultMod as default }
