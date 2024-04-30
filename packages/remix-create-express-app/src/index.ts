import fs from 'node:fs'
import { type Server } from 'node:net'
import url from 'node:url'
import {
  createRequestHandler as createExpressRequestHandler,
  type GetLoadContextFunction,
} from '@remix-run/express'
import { type ServerBuild } from '@remix-run/node'
import express, { type Application } from 'express'
import sourceMapSupport from 'source-map-support'
import { createMiddlewareRequestHandler } from './middleware'

type CreateRequestHandlerFunction = typeof createExpressRequestHandler

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

  // call custom configure function if provided
  configure?.(app)

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

      return createRequestHandler({ build, mode, getLoadContext })(
        req,
        res,
        next,
      )
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
  return import(/*@vite-ignore*/ process.cwd() + '/build/server/index.js').then(
    build => {
      setRoutes(build)
      return build
    },
  ) as Promise<ServerBuild>
}

function importDevBuild() {
  return viteDevServer
    ?.ssrLoadModule('virtual:remix/server-build')
    .then(build => {
      setRoutes(build as ServerBuild)
      return build as ServerBuild
    }) as Promise<ServerBuild>
}

type RouteObject = ServerBuild['routes']['root']
type ReactRouterRouteObject = RouteObject & {
  children: ReactRouterRouteObject[]
}

let routes: ReactRouterRouteObject[]
function setRoutes(build: ServerBuild) {
  routes = convertRoutes(build.routes)
}
export function getRoutes() {
  return routes
}

// convert Remix routes to React Router routes
function convertRoutes(routes: ServerBuild['routes']) {
  if (!routes) {
    return []
  }

  const routeConfigs = Object.values(routes)

  function getChildren(parentId: string): ReactRouterRouteObject[] {
    return routeConfigs
      .filter(route => route.parentId === parentId)
      .map((route: RouteObject) => {
        return {
          ...route,
          children: getChildren(route.id),
        }
      })
  }
  return [
    { ...routes['root'], children: getChildren('root') },
  ] as ReactRouterRouteObject[]
}
