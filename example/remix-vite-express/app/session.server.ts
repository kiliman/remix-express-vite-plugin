import { createCookieSessionStorage } from '@remix-run/node'

export type SessionData = {
  count: number
  userId: string
}

export type SessionFlashData = {
  error: string
}

const { getSession, commitSession, destroySession } =
  createCookieSessionStorage<SessionData, SessionFlashData>({
    cookie: {
      name: '__session',
      path: '/',
      sameSite: 'lax',
      secrets: ['s3cret1'],
    },
  })

export { commitSession, destroySession, getSession }
