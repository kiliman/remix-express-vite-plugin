import { UserContext } from '#app/middleware/requireAuth'
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
} from '@remix-run/node'
import { Form, useLoaderData, useFetcher, Outlet } from '@remix-run/react'

export async function loader({ context }: LoaderFunctionArgs) {
  const user = context.get(UserContext)
  return { user }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const url = new URL(request.url)
  if (context.get(UserContext).name !== 'kiliman') {
    throw Error('Not kiliman')
  }
  return { test: 'ok', url: url.toString() }
}

export default function DashboardIndex() {
  const { user } = useLoaderData<typeof loader>()
  const fetcher = useFetcher()
  return (
    <section>
      <button
        type="submit"
        onClick={e => {
          fetcher.submit(
            {
              intent: 'bug',
            },
            { method: 'post', action: '/dashboard?index&abc=123' },
          )
        }}
      >
        Submit with fetcher
      </button>
      <pre>{JSON.stringify(fetcher.data, null, 2)}</pre>
    </section>
  )
}
