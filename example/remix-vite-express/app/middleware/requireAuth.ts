import { redirect } from '@remix-run/node'
import { type MiddlewareFunctionArgs } from 'remix-create-express-app/middleware'
import { createContext } from 'remix-create-express-app/context'
import cookie from 'cookie'

export type User = {
  name: string
}

export const UserContext = createContext<User>()

export async function requireAuth({
  request,
  context,
  next,
}: MiddlewareFunctionArgs) {
  // get user cookie
  const cookies = cookie.parse(request.headers.get('Cookie') ?? '')
  if (!cookies.user) {
    const url = new URL(request.url)
    throw redirect(`/login?redirectTo=${encodeURI(url.pathname + url.search)}`)
  }
  // set the user in the context from the cookie
  context.set(UserContext, { name: cookies.user })
  return next()
}
