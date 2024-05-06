import { type ActionFunctionArgs, redirect } from '@remix-run/node'
import { Form, Link } from '@remix-run/react'

export async function action({ request }: ActionFunctionArgs) {
  throw redirect('/', { headers: { 'Set-Cookie': `user=; Max-Age=0` } })
}

export default function Component() {
  return (
    <div>
      <h1>Login</h1>
      <Link to="/">Home</Link>
      <Form method="post">
        <input type="text" name="name" defaultValue="kiliman" />
        <button>Login</button>
      </Form>
    </div>
  )
}
