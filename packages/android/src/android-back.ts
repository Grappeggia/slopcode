export type AndroidBackHandler = () => boolean

declare global {
  interface Window {
    __slopcodeAndroidBack?: AndroidBackHandler
  }
}

export function handleAndroidBack(close: () => boolean, navigate: AndroidBackHandler) {
  if (close()) return true
  return navigate()
}

export function closeSshNavigation() {
  const drawer = document.querySelector<HTMLElement>("[data-ssh-drawer-open='true']")
  if (!drawer) return false
  document.querySelector<HTMLButtonElement>("[data-ssh-menu-toggle]")?.click()
  return true
}

export function installAndroidBack(navigate: AndroidBackHandler) {
  const previous = window.__slopcodeAndroidBack
  const handler = () => handleAndroidBack(closeSshNavigation, navigate)
  window.__slopcodeAndroidBack = handler
  return () => {
    if (window.__slopcodeAndroidBack === handler) window.__slopcodeAndroidBack = previous
  }
}
