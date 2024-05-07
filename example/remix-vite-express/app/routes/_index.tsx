import { SessionContext } from '#app/middleware/session'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'

export const meta: MetaFunction = () => {
  return [
    { title: 'New Remix App' },
    { name: 'description', content: 'Welcome to Remix!' },
  ]
}

export async function loader({ context }: LoaderFunctionArgs) {
  const session = context.get(SessionContext)
  const error = session.get('error')
  return { error }
}

export default function Index() {
  const { error } = useLoaderData<typeof loader>()
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.8' }}>
      <h1>Welcome to Remix</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        <li>
          <Link to="/test">Test</Link>
        </li>
        <li>
          <Link to="/test-redirect">Test Redirect</Link>
        </li>
        <li>
          <Link to="/test-error">Test Error</Link>
        </li>
        <li>
          <Link to="/dashboard">Dashboard</Link>
        </li>
      </ul>
    </div>
  )
}
