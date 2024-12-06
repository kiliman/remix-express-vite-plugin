# remix-express-dev-server

This package is a Vite plugin that loads your Express app in development. It
expects the app to have been created in your _entry.server.tsx_ file via the
`createExpressApp` help.

## Installation

Install the following npm package:

```bash
npm install -D remix-express-dev-server
```

## Configuration

Add the Vite plugin to your _vite.config.ts_ file. Also, configure
`build.target='esnext'` to support _top-level await_.

```ts
import { expressDevServer } from 'remix-express-dev-server'
import { vitePlugin as remix } from '@remix-run/dev'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  build: {
    target: 'esnext',
  },
  plugins: [
    expressDevServer(), // add expressDevServer plugin
    remix(),
    tsconfigPaths(),
  ],
})
```

### Options

The `expressDevServer` plugin also accepts options:

```ts
export type DevServerOptions = {
  entry?: string // Express app entry: default = 'virtual:remix/server-build'
  entryName?: string // name of express app export: default = app
  appDirectory?: string // path to remix app directory: default = ./app
  base?: string // base of your app without a trailing slash: default = '' (empty string)
  configureServer?: (server: http.Server) => void // allow additional configuration
  // of Vite dev server (like setting up socket.io)
}
```

## Package.json

The `scripts` for `dev` and `build` have been simplified.

Update `scripts` in your _package.json_ file. For development, Vite will handle
starting express and calling Remix to build your app, so simply call `vite`.

For building, Remix will build your app and create the server and client bundles.
The server bundle is in `./build/server/index.js`

To run your production build, call `node ./build/server/index.js`

Make sure to set `NODE_ENV=production`, otherwise it will not create your server.

```json
{
  "scripts": {
    "dev": "vite",
    "build": "remix vite:build",
    "start": "NODE_ENV=production node ./build/server/index.js"
  }
}
```

## Advanced configuration

### Socket.io

You can wrap the Vite dev server with the socket.io server.

> NOTE: `configureServer` is only called for development. In production, use the
> `createExpressApp({ createServer })` function to initialize socket.io. You
> can import same init function in both places.

```ts
// vite.config.ts
export default defineConfig({
  plugins: [
    expressDevServer({
      configureServer(server) {
        const io = new Server(server)

        io.on('upgrade', async (req, socket, head) => {
          console.log(
            `Attemping to upgrade connection at url ${
              req.url
            } with headers: ${JSON.stringify(req.headers)}`,
          )

          socket.on('error', err => {
            console.error('Connection upgrade error:', err)
          })

          console.log(`Client connected, upgrading their connection...`)
        })
        io.on('connection', socket => {
          console.log('Client connected')
          socket.emit('server', 'hello from server')
          socket.on('client', data => {
            console.log('Client sent:', data)
            socket.emit('server', data)
          })
          socket.on('disconnect', () => {
            console.log('Client disconnected')
          })
        })
      },
    }),
    // ...
  ],
})
```
