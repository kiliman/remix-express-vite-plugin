// middleware/session.ts
import { MiddlewareFunctionArgs } from 'remix-create-express-app/middleware'
import { commitSession, getSession } from '#app/session.server'

export type SessionMiddlewareArgs = {
  isCookieSessionStorage: boolean
}

// session middleware that auto-commits the session cookie when mutated
export function session({ isCookieSessionStorage }: SessionMiddlewareArgs) {
  return async ({ request, context, next }: MiddlewareFunctionArgs) => {
    const session = await getSession(request.headers.get('Cookie'))
    type PropType = keyof typeof session

    // setup a proxy to track if the session has been modified
    // so we can commit it back to the store
    const sessionProxy = {
      _isDirty: false,
      get isDirty() {
        return this._isDirty
      },
      get(target: typeof session, prop: PropType) {
        this._isDirty ||= ['set', 'unset', 'destroy'].includes(prop)
        return target[prop]
      },
    }
    context.session = new Proxy(session, sessionProxy) as typeof session

    const response = await next()

    if (sessionProxy.isDirty) {
      const result = await commitSession(context.session as typeof session)
      if (isCookieSessionStorage) {
        response.headers.append('Set-Cookie', result)
      }
    }
    return response
  }
}
