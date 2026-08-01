import type { NotificationPermission } from "./bridge"

export function notificationDecision(current: NotificationPermission, result = current) {
  if (current === "denied") return { request: false, show: false }
  if (current === "granted") return { request: false, show: true }
  return { request: true, show: result === "granted" }
}
