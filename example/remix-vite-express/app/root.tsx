import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react'

import { session } from '#app/middleware/session'
import { serverOnly$ } from 'vite-env-only'

// export your middleware as array of functions that Remix will call
// wrap middleware in serverOnly$ to prevent it from being bundled in the browser
// since remix doesn't know about middleware yet
export const middleware = serverOnly$([
  session({ isCookieSessionStorage: true }),
])

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}
