import { type ActionFunctionArgs, redirect } from '@remix-run/node'
import { Form, Link } from '@remix-run/react'

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url)
  const formData = await request.formData()
  const name = formData.get('name')

  const redirectUrl = url.searchParams.get('redirectTo') ?? '/'
  throw redirect(redirectUrl, { headers: { 'Set-Cookie': `user=${name}` } })
}

export default function Component() {
  return (
    <div>
      <h1>Login</h1>
      <Link to="/">Home</Link>
      <Form method="post" replace>
        <input type="text" name="name" defaultValue="kiliman" />
        <button>Login</button>
      </Form>
    </div>
  )
}
