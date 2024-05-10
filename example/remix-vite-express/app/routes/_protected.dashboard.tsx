import { LoaderFunctionArgs } from '@remix-run/node'
import { Form, Outlet } from '@remix-run/react'

export async function loader({ context }: LoaderFunctionArgs) {
  return null
}

export default function Component() {
  return (
    <div>
      <h2>Dashboard</h2>
      <Outlet />
    </div>
  )
}
