import type http from 'node:http'
import { minimatch } from 'minimatch'
import type { Connect, Plugin as VitePlugin, ViteDevServer } from 'vite'
import fs from 'node:fs'

export type DevServerOptions = {
  entry?: string
  exportName?: string
  appDirectory?: string
  base?: string
  configureServer?: (server: http.Server) => void
}

export const defaultOptions: Required<DevServerOptions> = {
  entry: 'virtual:remix/server-build',
  exportName: 'app',
  appDirectory: './app',
  base: "",
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

export function expressDevServer(options?: DevServerOptions): VitePlugin {
  const entry = options?.entry ?? defaultOptions.entry
  const exportName = options?.exportName ?? defaultOptions.exportName
  const configureServer =
    options?.configureServer ?? defaultOptions.configureServer
  const appDirectory = normalizeAppDirectory(
    options?.appDirectory ?? defaultOptions.appDirectory,
  )
  const base = options?.base ?? defaultOptions.base

  const basePattern = escapeRegExp(base);
  const appDirectoryPattern = new RegExp(`^${basePattern}${escapeRegExp(appDirectory)}`)

  const plugin: VitePlugin = {
    name: 'remix-express-dev-server',
    enforce: 'post',
    configureServer: async server => {
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
          const exclude = [
            new RegExp(`^${basePattern}/@.+$`),
            new RegExp(`^${basePattern}/node_modules/.*`)
          ]

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
            if (fs.existsSync(url.pathname.replace(base, "").slice(1))) {
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
