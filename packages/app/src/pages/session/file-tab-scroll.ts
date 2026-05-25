type Input = {
  prevScrollWidth: number
  scrollWidth: number
  clientWidth: number
  prevContextOpen: boolean
  contextOpen: boolean
}

type Box = {
  left: number
  right: number
}

type Tab = Box & {
  hovered: boolean
  selected: boolean
}

export const nextTabListScrollLeft = (input: Input) => {
  if (input.scrollWidth <= input.prevScrollWidth) return
  if (!input.prevContextOpen && input.contextOpen) return 0
  if (input.scrollWidth <= input.clientWidth) return
  return input.scrollWidth - input.clientWidth
}

export const nextTabListDivider = (input: { list: Box; tabs: Tab[] }) => {
  const index = input.tabs.findIndex((tab) => tab.right > input.list.left)
  if (index < 0) return
  const tab = input.tabs[index]!
  return {
    index,
    left: Math.max(tab.left - input.list.left, 0),
    hovered: tab.hovered,
    selected: tab.selected,
  }
}

export const nextTabListDividerLeft = (input: { list: Box; tabs: Box[] }) =>
  nextTabListDivider({
    list: input.list,
    tabs: input.tabs.map((tab) => ({
      ...tab,
      hovered: false,
      selected: false,
    })),
  })?.left

const syncLeadingDivider = (el: HTMLDivElement) => {
  const divider = el.parentElement?.querySelector<HTMLElement>('[data-slot="tabs-leading-divider"]')
  if (!divider) return

  const list = el.getBoundingClientRect()
  const tabs = Array.from(el.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger-wrapper"]')).map((tab) => {
    const box = tab.getBoundingClientRect()
    return {
      el: tab,
      left: box.left,
      right: box.right,
      hovered: tab.matches(":hover"),
      selected: tab.querySelector("[data-selected]") !== null,
      visible: box.width > 0 && box.left < list.right && box.right > list.left,
    }
  })
  const visible = tabs.filter((tab) => tab.visible)
  const next = nextTabListDivider({
    list,
    tabs: visible.map((tab) => ({
      left: tab.left,
      right: tab.right,
      hovered: tab.hovered,
      selected: tab.selected,
    })),
  })

  tabs.forEach((tab) => tab.el.removeAttribute("data-leading-edge-owner"))
  divider.removeAttribute("data-hovered")
  divider.removeAttribute("data-selected")
  divider.toggleAttribute("data-hidden", next === undefined)
  if (!next) return

  visible[next.index]?.el.setAttribute("data-leading-edge-owner", "true")
  divider.toggleAttribute("data-hovered", next.hovered)
  divider.toggleAttribute("data-selected", next.selected)
  divider.style.left = `${next.left}px`
}

export const createFileTabListSync = (input: { el: HTMLDivElement; contextOpen: () => boolean }) => {
  let frame: number | undefined
  let prevScrollWidth = input.el.scrollWidth
  let prevContextOpen = input.contextOpen()

  const update = () => {
    const scrollWidth = input.el.scrollWidth
    const clientWidth = input.el.clientWidth
    const contextOpen = input.contextOpen()
    const left = nextTabListScrollLeft({
      prevScrollWidth,
      scrollWidth,
      clientWidth,
      prevContextOpen,
      contextOpen,
    })

    if (left !== undefined) {
      input.el.scrollTo({
        left,
        behavior: "smooth",
      })
    }

    syncLeadingDivider(input.el)
    prevScrollWidth = scrollWidth
    prevContextOpen = contextOpen
  }

  const schedule = () => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = undefined
      update()
    })
  }

  const onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    input.el.scrollLeft += e.deltaY > 0 ? 50 : -50
    e.preventDefault()
  }
  const onPointer = () => schedule()

  input.el.addEventListener("wheel", onWheel, { passive: false })
  input.el.addEventListener("scroll", schedule, { passive: true })
  input.el.addEventListener("pointerover", onPointer, { passive: true })
  input.el.addEventListener("pointerout", onPointer, { passive: true })
  const observer = new MutationObserver(schedule)
  observer.observe(input.el, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["data-selected"],
  })
  const resize = new ResizeObserver(schedule)
  resize.observe(input.el)
  schedule()

  return () => {
    input.el.removeEventListener("wheel", onWheel)
    input.el.removeEventListener("scroll", schedule)
    input.el.removeEventListener("pointerover", onPointer)
    input.el.removeEventListener("pointerout", onPointer)
    observer.disconnect()
    resize.disconnect()
    if (frame !== undefined) cancelAnimationFrame(frame)
  }
}
