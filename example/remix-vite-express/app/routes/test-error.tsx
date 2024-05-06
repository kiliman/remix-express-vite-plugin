import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'

export async function loader({ request }: LoaderFunctionArgs) {
  throw new Error('Oops!')
}
