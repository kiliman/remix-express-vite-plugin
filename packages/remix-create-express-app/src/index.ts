import fs from 'node:fs'
import path from 'node:path'
import { type Server } from 'node:net'
import url from 'node:url'
import {
  createRequestHandler as createExpressRequestHandler,
  GetLoadContextFunction as ExpressGetLoadContextFunction,
} from './remix.js'
import { AppLoadContext, type ServerBuild } from '@remix-run/node'
import express, { type Application } from 'express'
import sourceMapSupport from 'source-map-support'
import { createMiddlewareRequestHandler } from './middleware.js'
import { setRoutes } from './routes.js'
import compression from 'compression'
import morgan from 'morgan'

type CreateRequestHandlerFunction = typeof createExpressRequestHandler
type GetLoadContextFunction = (
  req: express.Request,
  res: express.Response,
  args: {
    build: ServerBuild
  },
) => Promise<AppLoadContext> | AppLoadContext

export type CreateExpressAppArgs = {
  configure?: (app: Application) => void
  getLoadContext?: GetLoadContextFunction
  customRequestHandler?: (
    defaultCreateRequestHandler: CreateRequestHandlerFunction,
  ) => CreateRequestHandlerFunction
  getExpress?: () => Application
  createServer?: (app: Application) => Server
  unstable_middleware?: boolean
}

export function createExpressApp({
  configure,
  getLoadContext,
  customRequestHandler,
  getExpress,
  createServer,
  unstable_middleware,
}: CreateExpressAppArgs) {
  sourceMapSupport.install({
    retrieveSourceMap: function (source) {
      const match = source.startsWith('file://')
      if (match) {
        const filePath = url.fileURLToPath(source)
        const sourceMapPath = `${filePath}.map`
        if (fs.existsSync(sourceMapPath)) {
          return {
            url: source,
            map: fs.readFileSync(sourceMapPath, 'utf8'),
          }
        }
      }
      return null
    },
  })

  const mode =
    process.env.NODE_ENV === 'test' ? 'development' : process.env.NODE_ENV

  const isProductionMode = mode === 'production'

  const app = getExpress?.() ?? express()

  // Vite fingerprints its assets so we can cache forever.
  app.use(
    '/assets',
    express.static('build/client/assets', { immutable: true, maxAge: '1y' }),
  )

  // Everything else (like favicon.ico) is cached for an hour. You may want to be
  // more aggressive with this caching.
  app.use(
    express.static(isProductionMode ? 'build/client' : 'public', {
      maxAge: '1h',
    }),
  )

  if (configure) {
    // call custom configure function if provided
    configure(app)
  } else {
    // otherwise setup default middleware similar to remix app server
    app.disable('x-powered-by')
    app.use(compression())
    app.use(morgan('tiny'))
  }

  const defaultCreateRequestHandler = unstable_middleware
    ? createMiddlewareRequestHandler
    : createExpressRequestHandler

  const createRequestHandler =
    customRequestHandler?.(
      defaultCreateRequestHandler as CreateRequestHandlerFunction,
    ) ?? defaultCreateRequestHandler

  // handle remix requests
  app.all(
    '*',
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      const build = isProductionMode
        ? await importProductionBuild()
        : await importDevBuild()

      const expressGetLoadContextFunction: ExpressGetLoadContextFunction =
        async (req, res) => {
          return getLoadContext?.(req, res, { build }) ?? {}
        }

      return createRequestHandler({
        build,
        mode,
        getLoadContext: expressGetLoadContextFunction,
      })(req, res, next)
    },
  )

  const port = process.env.PORT ?? 3000
  const host = process.env.HOST ?? 'localhost'

  if (isProductionMode) {
    // create a custom server if createServer function is provided
    const server = createServer?.(app) ?? app
    // check if server is an https/http2 server
    const isSecureServer = !!('cert' in server && server.cert)

    server.listen(port, () => {
      const url = new URL(`${isSecureServer ? 'https' : 'http'}://${host}`)
      // setting port this way because it will not explicitly set the port
      // if it's the default port for the protocol
      url.port = String(port)
      console.log(`Express server listening at ${url}`)
    })
  }

  return app
}

// This server is only used to load the dev server build
const viteDevServer =
  process.env.NODE_ENV === 'production'
    ? undefined
    : await import('vite').then(vite =>
        vite.createServer({
          server: { middlewareMode: true },
          appType: 'custom',
        }),
      )

function importProductionBuild() {
  return import(
    /*@vite-ignore*/
    url
      .pathToFileURL(
        path.resolve(path.join(process.cwd(), '/build/server/index.js')),
      )
      .toString()
  ).then(build => {
    setRoutes(build)
    return build
  }) as Promise<ServerBuild>
}

function importDevBuild() {
  return viteDevServer
    ?.ssrLoadModule('virtual:remix/server-build')
    .then(build => {
      setRoutes(build as ServerBuild)
      return build as ServerBuild
    }) as Promise<ServerBuild>
}
