import {
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  redirect,
} from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'

export async function loader({ context }: LoaderFunctionArgs) {
  const count = Number(context.session.get('count') || 0)

  return { message: context.sayHello(), now: Date.now(), count }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData()
  if (formData.has('inc')) {
    // you should only see set-cookie header when session is modified
    const count = Number(context.session.get('count') || 0)
    context.session.set('count', count + 1)
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
      </Form>
      <pre>{JSON.stringify(loaderData, null, 2)}</pre>
    </div>
  )
}
