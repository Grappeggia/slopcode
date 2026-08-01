export function shouldCreateDefaultProject(input: {
  pending: boolean
  existingInstall: boolean
  local: boolean
  tabCount: number
  serverCount: number
  builtInServerCount: number
}) {
  return (
    input.pending &&
    !input.existingInstall &&
    input.local &&
    input.tabCount === 0 &&
    input.serverCount === input.builtInServerCount
  )
}
