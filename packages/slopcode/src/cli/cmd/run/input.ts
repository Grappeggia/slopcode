export function interactivePrompt(input: { command?: string; message: string }) {
  const message = input.message.trim()
  if (!input.command) return message || undefined
  const command = input.command.startsWith("/") ? input.command : `/${input.command}`
  if (!message) return command
  return `${command} ${message}`
}
