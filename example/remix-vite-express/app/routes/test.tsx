import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'

export async function loader({ context }: LoaderFunctionArgs) {
  return json({ message: context.sayHello() })
}

export default function Component() {
  const loaderData = useLoaderData<typeof loader>()

  return (
    <div>
      <h1>Test</h1>
      <p>Message from context</p>
      <pre>{JSON.stringify(loaderData, null, 2)}</pre>
    </div>
  )
}
