# remix-create-express-app

This package contains a helper function that enables you to create your Express
app directly from you _entry.server.tsx_. Since the Express app is built along
with the rest of your Remix app, you may import app modules as needed. It also
supports Vite HMR via the `remix-express-dev-server` plugin (which is required
for this to function).

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

export default createExpressApp({
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
