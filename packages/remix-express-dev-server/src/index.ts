import type http from 'node:http'
import { minimatch } from 'minimatch'
import type { Connect, Plugin as VitePlugin, ViteDevServer } from 'vite'
import fs from 'node:fs'

export type DevServerOptions = {
  entry?: string
  exportName?: string
  appDirectory?: string
  vitePaths?: RegExp[]
  configureServer?: (server: http.Server) => void
}

export const defaultOptions: Required<DevServerOptions> = {
  entry: 'virtual:remix/server-build',
  exportName: 'app',
  appDirectory: './app',
  vitePaths: [],
  configureServer: () => {},
}

export type Fetch = (request: Request) => Promise<Response>
export type AppHandle = {
  handle: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next: Connect.NextFunction,
  ) => void
}

/**
 * Cross-package rendezvous key. `remix-create-express-app` reads this at
 * module-load time to reuse the outer Vite dev server instead of spinning up
 * its own. Without the rendezvous, entry.server.tsx evaluates twice in
 * separate SSR runtimes — every module-level `const` (including any
 * globalThis patch from MSW, Sentry's HTTP instrumentation, etc.) ends up
 * with two distinct copies, and the second copy silently shadows the first.
 *
 * Must match the literal in `remix-create-express-app/src/index.ts`.
 */
export const VITE_DEV_SERVER_GLOBAL_KEY = Symbol.for(
  'remix-create-express-app:vite-dev-server',
)

export function expressDevServer(options?: DevServerOptions): VitePlugin {
  const entry = options?.entry ?? defaultOptions.entry
  const exportName = options?.exportName ?? defaultOptions.exportName
  const configureServer =
    options?.configureServer ?? defaultOptions.configureServer
  let appDirectory = normalizeAppDirectory(
    options?.appDirectory ?? defaultOptions.appDirectory,
  )

  const appDirectoryPattern = new RegExp(`^${escapeRegExp(appDirectory)}`)

  const plugin: VitePlugin = {
    name: 'remix-express-dev-server',
    enforce: 'post',
    configureServer: async server => {
      // Stash the outer dev server BEFORE anything else can evaluate the
      // entry server module. `remix-create-express-app`'s top-level code
      // reads from this slot the first time it loads (which happens during
      // the first `ssrLoadModule(virtual:remix/server-build)` call). Last
      // write wins: the Remix child compiler also fires this hook, but its
      // configureServer runs INSIDE the outer dev server's `configResolved`,
      // so the outer's hook always lands last and stays.
      ;(globalThis as Record<symbol, unknown>)[VITE_DEV_SERVER_GLOBAL_KEY] =
        server

      async function createMiddleware(
        server: ViteDevServer,
      ): Promise<Connect.HandleFunction> {
        // allow for additional configuration of vite dev server
        configureServer(server.httpServer as http.Server)

        return async function ExpressDevServerMiddleware(
          req: http.IncomingMessage,
          res: http.ServerResponse,
          next: Connect.NextFunction,
        ): Promise<void> {
          // exclude requests that should be handled by Vite dev server
          const exclude = [/^\/@.+$/, /^\/node_modules\/.*/, ...(options?.vitePaths ?? [])]

          for (const pattern of exclude) {
            if (req.url) {
              if (pattern instanceof RegExp) {
                if (pattern.test(req.url)) {
                  return next()
                }
              } else if (minimatch(req.url?.toString(), pattern)) {
                return next()
              }
            }
          }
          // check if url is a physical file in the app directory
          if (appDirectoryPattern.test(req.url!)) {
            const url = new URL(req.url!, 'http://localhost')
            if (fs.existsSync(url.pathname.slice(1))) {
              return next()
            }
          }

          let ssrModule

          try {
            let module = await server.moduleGraph.getModuleByUrl(entry)
            if (module) {
              ssrModule = module.ssrModule
            }
          } catch (e) {
            return next(e)
          }
          if (!ssrModule) {
            ssrModule = await server.ssrLoadModule(entry)
          }

          const entryModule = ssrModule?.entry?.module

          if (entryModule === undefined) {
            return next()
          }

          // explicitly typed since express handle function is not exported
          let app = entryModule[exportName] as AppHandle | Promise<AppHandle>
          if (!app) {
            return next(
              new Error(
                `Failed to find a named export "${exportName}" from ${entry}`,
              ),
            )
          }
          if (app instanceof Promise) {
            app = await app
          }
          // pass request to the Express app
          app.handle(req, res, next)
        }
      }

      server.middlewares.use(await createMiddleware(server))
      server.httpServer?.on('close', async () => {})
    },
  }
  return plugin
}

function normalizeAppDirectory(appDirectory: string) {
  // replace backslashes with forward slashes
  appDirectory = appDirectory.replace(/\\/g, '/')
  // remove leading dot
  if (appDirectory.startsWith('.')) appDirectory = appDirectory.slice(1)
  // add leading slash
  if (!appDirectory.startsWith('/')) appDirectory = `/${appDirectory}`
  // add trailing slash
  if (!appDirectory.endsWith('/')) appDirectory = `${appDirectory}/`
  return appDirectory
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
