# remix-create-express-app

This package contains a helper function that enables you to create your Express
app directly from you _entry.server.tsx_. Since the Express app is built along
with the rest of your Remix app, you may import app modules as needed. It also
supports Vite HMR via the `remix-express-dev-server` plugin (which is required
for this to function).

## Remix Middleware (New in v0.3.0)

You can now add middleware to your routes. See below for more information.

## Installation

Install the following npm package. NOTE: This is not a dev dependency, as it
creates the Express app used in production. This is why the two packages are
split. This way you can eliminate the dev tooling when building a production
image.

```bash
npm install remix-create-express-app
```

## Configuration

From your _entry.server.tsx_ file, export the app from `createExpressApp` and
name it `app` or the name you defined in `expressDevServer({exportName})`.

This helper function works differently depending on the environment.

For `development`, it creates an Express app that the Vite plugin will load
via `viteDevServer.ssrLoadModule('virtual:remix/server-build'). The actual server
is controlled by Vite, and can be configured via _vite.config.ts_ `server` options.

For `production`, it will create a standard node HTTP server listening at `HOST:PORT`.
You can customize the production server using the `createServer` option defined
below.

### Options

```ts
export type CreateExpressAppArgs = {
  // configure the app to add additional express middleware
  configure?: (app: Application) => void

  // get the remix AppLoadContext
  getLoadContext?: GetLoadContextFunction

  // the helper will automatically setup the remix request handler
  // but you can use this to wrap the default handler, for example sentry.
  customRequestHandler?: (
    defaultCreateRequestHandler: CreateRequestHandlerFunction,
  ) => CreateRequestHandlerFunction

  // by default, it will use a standard express object, but you can override
  // it for example to return one that handles http2
  getExpress?: () => Application

  // this function can be used to create an https or http2 server
  createServer?: (app: Application) => Server

  // set to true to use unstable middleware
  unstable_middleware?: boolean
}
```

You can add additional Express middleware with the `configure` function.

If you want to set up the Remix `AppLoadContext`, pass in a function to `getLoadContext`.
Modify the `AppLoadContext` interface used in your app.

Since the Express app is compiled in the same bundle as the rest of your Remix
app, you can import app modules just like you normally would.

### Example

```ts
// server/index.ts

import { createExpressApp } from 'remix-create-express-app'
import compression from 'compression'
import morgan from 'morgan'
import { sayHello } from '#app/hello.server.ts'

// update the AppLoadContext interface used in your app
declare module '@remix-run/node' {
  interface AppLoadContext {
    sayHello: () => string
  }
}

export const app = createExpressApp({
  configure: app => {
    // setup additional express middleware here
    app.use(compression())
    app.disable('x-powered-by')
    app.use(morgan('tiny'))
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getLoadContext: async (req, res) => {
    // custom load context should match the AppLoadContext interface defined above
    return { sayHello }
  },
})
```

```ts
// app/hello.server.ts
export const sayHello = () => 'Hello, World!'
```

```ts
// routes/test.tsx

export async function loader({ context }: LoaderFunctionArgs) {
  // get the context provided from `getLoadContext`
  return json({ message: context.sayHello() })
}
```

## Advanced Configuration

### HTTP/2

```ts
import http2 from 'node:http2'
import http2Express from 'http2-express-bridge'

export const app = createExpressApp({
  // ...
  getExpress: () => {
    // create a custom express app, needed for HTTP/2
    return http2Express(express)
  },
  createServer: app => {
    // create a custom server for production
    // use Vite config `server` to customize the dev server
    return http2.createSecureServer(
      {
        key: fs.readFileSync(process.cwd() + '/server/localhost-key.pem'),
        cert: fs.readFileSync(process.cwd() + '/server/localhost-cert.pem'),
      },
      app,
    )
  },
})
```

### Sentry request handler

```ts
import { wrapExpressCreateRequestHandler } from '@sentry/remix'

export const app = createExpressApp({
  // ...
  customRequestHandler: defaultCreateRequestHandler => {
    // enables you to wrap the default request handler
    return process.env.NODE_ENV === 'production'
      ? wrapExpressCreateRequestHandler(defaultCreateRequestHandler)
      : defaultCreateRequestHandler // use default in dev
  },
})
```

## Middleware

Middleware are functions that are called before Remix calls your loader/action. This
implementation **Unofficial**, but is based on the [Route Middleware RFC](https://github.com/remix-run/remix/discussions/7642). So it should be mostly compatible once Remix implements Middleware
directly.

This implementation is done strictly in user-land and does not modify the core Remix
library. However, it does require the new _Single Fetch_ API that was introduced
in Remix v2.9.

In addition, this middleware implementation currently only supports the Express
adapter. Once it stabilizes, I will look at supporting other adapters, namely Vercel
and Cloudflare.

### Configuration

As stated above, you will need to be on Remix v2.9+ and enable `unstable_singleFetch:true`
in your _vite.config.ts_. We also need the `envOnly` plugin from `vite-env-only`. Since
Remix doesn't know about the `middleware` export, it does not know to only include
it in the server build. We'll wrap the export in `serverOnly$` to ensure it only
ends up in the server bundle.

```ts
// vite.config.ts
// we'll need serverOnly$ for the middleware export
import envOnly from 'vite-env-only'

// single fetch requires nativeFetch: true
installGlobals({ nativeFetch: true })

export default defineConfig({
  build: {
    target: 'esnext',
  },
  plugins: [
    expressDevServer(),
    // need the vite-env-only plugin for middleware export
    envOnly(),
    remix({
      // middleware requires unstable_singleFetch: true
      future: { unstable_singleFetch: true },
    }),
    tsconfigPaths(),
  ],
})
```

### Creating Middleware

A middleware is any function that has the following signature:

```ts
export type MiddlewareFunctionArgs = {
  request: Request
  params: Record<string, string>
  context: AppLoadContext
  matches: ReturnType<typeof matchRoutes>
  next: () => Promise<Response>
}

export type MiddleWareFunction = (
  args: MiddlewareFunctionArgs,
) => Response | undefined
```

You can have multiple middleware functions for a given route. In your route, export the
`middleware` array of functions.

```ts
// routes/some-route.tsx
export middleware = [middleware1, middleware2, middleware3]
```

When a URL is request, the Express handler will first get the matching routes,
the same way that Remix matches routes. It will get a list of routes from the
root route to the leaf route.

It then checks each matching route for a `middleware` export. Finally, it combines
all the `middleware` arrays for all the matching routes to create a single array
of middleware function (via `flatMap`). They will then be executed in the order
they were defined from the _root_ to the leaf route.

NOTE: These middleware functions are executed in serial, unlike loaders. Once all
the middleware are executed, Remix will then run the matching loaders and actions
in parallel as usual.

Each middleware function receives the current `context` object that is initialized by the
`getLoadContext` function in `createExpressApp`. This context object is _mutable_
and will be passed along the middleware chain. This way each middleware function
can add additional data to the context or perform logic based on this data.

In addition, middleware function can inspect the `Request` object. It can also
modify the request by adding or removing headers.

A middleware function is responsible for calling the `next` function and returning
the response that is returned.

The middleware function can inspect the response as well as update the headers. This
response is passed back up the middleware chain, and then after the final middleware
function returns, the response is then sent to the client.

Here is an example middleware. It adds the `session` object to the `context`. In
addition to making it easy to access the session, it will also commit
the session if mutated. If you are using the cookie session storage, it will also add
the `set-cookie` header automatically.

```ts
// entry.server.tsx
declare module '@remix-run/server-runtime' {
  export interface AppLoadContext {
    sayHello: () => string
    // add session to the context for type safety
    session: Session<SessionData, SessionFlashData>
  }
}

// -------------------
// root.tsx
import { session } from '#app/middleware/session.ts'
import { serverOnly$ } from 'vite-env-only'

// export your middleware as array of functions that Remix will call
// wrap middleware in serverOnly$ to prevent it from being bundled in the browser
// since remix doesn't know about middleware yet
export const middleware = serverOnly$([
  session({ isCookieSessionStorage: true }),
])

//---------------------
// routes/test.tsx
export async function loader({ context }: LoaderFunctionArgs) {
  // get the session object directly from context
  const count = Number(context.session.get('count') || 0)

  return { message: context.sayHello(), count }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const formData = await request.formData()
  if (formData.has('inc')) {
    // you should only see set-cookie header when session is modified
    const count = Number(context.session.get('count') || 0)
    // mutate the session
    context.session.set('count', count + 1)
  }
  throw redirect('/test')
}
```

Here is a more complex chain of middleware

```ts
// root.tsx
// multiple middleware executed in sequence
export middleware = [middleware1, middleware2]

async function middleware1({ request, context, next }: MiddlewareFunctionArgs) {
  // modify request headers
  request.headers.set('x-some-header', 'root1')
  // update context
  context.root1 = 'added by root1 middleware'
  // call next middleware
  const response = await next()
  // update response headers
  response.headers.set('x-some-other-header', 'root1 middleware')
  // return the response
  return response
}

async function middleware2({ request, context, next }: MiddlewareFunctionArgs) {
  // get header set by previous middleware
  const header1 = request.headers.get('x-some-header')
  // add additional request headers
  request.headers.set('x-another-header', 'root2')
  // update context with more data
  context.root2 = 'added by root2 middleware'
  // access context data set by previous middleware
  const context1 = context.root1
    // call next middleware
  const response = await next()
  // check response status
  if (response.status === 404) {
    throw redirect('/another-page')   // note thrown responses/errors are still WIP
  }
  // update response headers
  response.headers.append('x-yet-another', 'root2 middleware')
  // return the response
  return response
}


//-----------------
// routes/child.tsx
//
export middleware = [middleware3]

async function middleware3({ request, context, next }: MiddlewareFunctionArgs) {
  // do more stuff with request headers and context

  // return the response from next
  return await next()
}
```

Here's how the middleware will execute

```
GET /test
--- middleware executed in sequence ---
execute root.middleware1
execute root.middleware2
execute child.middleware3

--- remix executes loaders in parallel ---
execute root.loader + child.loader

--- walk back up the chain return response ---
return response from child
return response from root
return response from child.middleware3
return response from root.middleware2
return response from root.middleware1

--- finally return resopnse to client ---
return response to client
```
