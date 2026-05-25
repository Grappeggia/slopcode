type SessionLike = {
  id: string
  parentID?: string | null
}

export function sessionThreadRoot<T extends SessionLike>(sessions: T[], sessionID?: string) {
  if (!sessionID) return sessionID
  const map = new Map(sessions.map((item) => [item.id, item]))
  let current = map.get(sessionID)
  while (current?.parentID) current = map.get(current.parentID)
  return current?.id ?? sessionID
}

export function sessionTreeIDs<T extends SessionLike>(sessions: T[], sessionID?: string) {
  if (!sessionID) return [] as string[]
  const map = sessions.reduce((acc, item) => {
    if (!item.parentID) return acc
    const list = acc.get(item.parentID)
    if (list) list.push(item.id)
    if (!list) acc.set(item.parentID, [item.id])
    return acc
  }, new Map<string, string[]>())

  const seen = new Set([sessionID])
  const ids = [sessionID]
  for (const id of ids) {
    const list = map.get(id)
    if (!list) continue
    for (const child of list) {
      if (seen.has(child)) continue
      seen.add(child)
      ids.push(child)
    }
  }
  return ids
}
