# remix-express-vite-plugin

This package includes a Vite plugin to use in your Remix app. It configures
an Express server for both development and production.

## Installation

Install the following npm package

```bash
npm install -D remix-express-vite-plugin
```

## Configuration

Add the Vite plugin and preset to your _vite.config.ts_ file

```ts
import { expressDevServer, expressPreset } from 'remix-express-vite-plugin/vite'
import { vitePlugin as remix } from '@remix-run/dev'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: {
    port: 3000, // define dev server port here to override default port 5173
  },
  plugins: [
    expressDevServer(), // add expressDevServer plugin

    remix({
      presets: [expressPreset()], // add expressPreset for server build support
    }),
    tsconfigPaths(),
  ],
})
```

### Options

The `expressDevServer` plugin also accepts options:

```ts
export type DevServerOptions = {
  entry?: string // Express app entry: default = './server/index.ts'
  ignoreWatching?: (string | RegExp)[] // List of paths to ignore for change:
  // default = []
}
```

## Package.json

Update `scripts` in your _package.json_ file. For development, Vite will handle
starting express and calling Remix to build your app, so simply call `vite`.

For building, Remix will build your app and create the server and client bundles.
The `expressPreset` will build your express server file into _./build/server/index.js_

To run your production build, call `node ./build/server/index.js`

```json
{
  "scripts": {
    "dev": "vite",
    "build": "remix vite:build",
    "start": "node ./build/server/index.js"
  }
}
```

## Express

You can now use a TypeScript file for your Express server. The default entry is
_server/index.ts_

Export the created Express app as the `default` export. A helper function named
`createExpressApp` will automatically set up the Remix request handler.

### Options

```ts
export type CreateExpressAppArgs = {
  configure?: (app: Application) => void // add additional middleware to app
  getLoadContext?: GetLoadContextFunction // setup remix context
}
```

You can add additional Express middleware with the `configure` function.

If you want to set up the Remix `AppLoadContext`, pass in a function to `getLoadContext`.
Modify the `AppLoadContext` interface used in your app.

### Example

```ts
// server/index.ts

import { createExpressApp } from 'remix-express-vite-plugin/express'
import compression from 'compression'
import morgan from 'morgan'

// update the AppLoadContext interface used in your app
declare module '@remix-run/node' {
  interface AppLoadContext {
    hello: () => string
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
    return { hello: () => 'Hello, World!' }
  },
})
```

```ts
// routes/test.tsx

export async function loader({ context }: LoaderFunctionArgs) {
  // get the context provided from `getLoadContext`
  return json({ message: context.hello() })
}
```
