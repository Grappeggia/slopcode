import type { PermissionRequest, QuestionRequest, Session } from "@slopcode-ai/sdk/v2/client"

function sessionTreeRequests<T>(
  session: Session[],
  request: Record<string, T[] | undefined>,
  sessionID?: string,
  include: (item: T) => boolean = () => true,
) {
  if (!sessionID) return [] as T[]

  const map = session.reduce((acc, item) => {
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

  return ids.flatMap((id) => request[id]?.filter(include) ?? [])
}

export function sessionPermissionRequests(
  session: Session[],
  request: Record<string, PermissionRequest[] | undefined>,
  sessionID?: string,
  include?: (item: PermissionRequest) => boolean,
) {
  return sessionTreeRequests(session, request, sessionID, include)
}

export function sessionPermissionRequest(
  session: Session[],
  request: Record<string, PermissionRequest[] | undefined>,
  sessionID?: string,
  include?: (item: PermissionRequest) => boolean,
) {
  return sessionPermissionRequests(session, request, sessionID, include)[0]
}

export function sessionQuestionRequest(
  session: Session[],
  request: Record<string, QuestionRequest[] | undefined>,
  sessionID?: string,
  include?: (item: QuestionRequest) => boolean,
) {
  return sessionTreeRequests(session, request, sessionID, include)[0]
}

export function sessionWaiting(input: {
  session: Session[]
  permission: Record<string, PermissionRequest[] | undefined>
  question: Record<string, QuestionRequest[] | undefined>
  sessionID?: string
  includePermission?: (item: PermissionRequest) => boolean
  includeQuestion?: (item: QuestionRequest) => boolean
}) {
  return (
    !!sessionPermissionRequest(input.session, input.permission, input.sessionID, input.includePermission) ||
    !!sessionQuestionRequest(input.session, input.question, input.sessionID, input.includeQuestion)
  )
}
