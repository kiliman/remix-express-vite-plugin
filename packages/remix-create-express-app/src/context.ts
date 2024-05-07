const SERVER_CONTEXT_MAP = Symbol('SERVER_CONTEXT_MAP')

export type ContextType<T> = Record<string, any> & T

export type ServerContext = {
  get: typeof contextGet
  set: typeof contextSet
  [SERVER_CONTEXT_MAP]: ContextMap
}

type ContextMap = Map<unknown, unknown>

export function createContext<T>(): ContextType<T> {
  return {} as ContextType<T>
}

function getContextMap(context: ServerContext) {
  let contextMap = context[SERVER_CONTEXT_MAP]
  if (!contextMap) {
    contextMap = new Map<unknown, unknown>()
    context[SERVER_CONTEXT_MAP] = contextMap
  }
  return contextMap
}

export function contextSet<T>(contextType: ContextType<T>, value: T) {
  // @ts-expect-error this
  let context = this as ServerContext
  let contextMap = getContextMap(context)
  contextMap.set(contextType, value)
}

export function contextGet<T>(contextType: ContextType<T>) {
  // @ts-expect-error this
  let context = this as ServerContext
  let contextMap = getContextMap(context)

  const value = contextMap.get(contextType)
  if (value === undefined) {
    throw new Error(`Context not found for ${contextType}`)
  }
  return value as T
}
