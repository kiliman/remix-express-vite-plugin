import { SessionContext } from '#app/middleware/session'
import {
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  redirect,
} from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'

export async function loader({ context }: LoaderFunctionArgs) {
  // get the session from context
  const session = context.get(SessionContext)
  const count = Number(session.get('count') || 0)
  return { message: context.sayHello(), now: Date.now(), count }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const session = context.get(SessionContext)
  const formData = await request.formData()
  if (formData.has('inc')) {
    // you should only see set-cookie header when session is modified
    const count = Number(session.get('count') || 0)
    session.set('count', count + 1)
  } else if (formData.has('flash')) {
    session.flash('error', 'This is a flash message')
    throw redirect('/')
  }
  throw redirect('/test')
}

export default function Component() {
  const loaderData = useLoaderData<typeof loader>()
  const { count } = loaderData

  return (
    <div>
      <h1>Test</h1>
      <p>Message from context</p>
      <Form method="post">
        <button name="inc">Count: {count}</button>
        <button>POST without mutation</button>
        <button name="flash">Flash</button>
      </Form>
      <pre>{JSON.stringify(loaderData, null, 2)}</pre>
    </div>
  )
}
