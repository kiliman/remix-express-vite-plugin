import type http from 'node:http'
import { minimatch } from 'minimatch'
import type { Connect, Plugin as VitePlugin, ViteDevServer } from 'vite'

export type DevServerOptions = {
  entry?: string
  exportName?: string
  appDirectory?: string
}

export const defaultOptions: Required<DevServerOptions> = {
  entry: 'virtual:remix/server-build',
  exportName: 'app',
  appDirectory: './app',
}

export type Fetch = (request: Request) => Promise<Response>

export function expressDevServer(options?: DevServerOptions): VitePlugin {
  const entry = options?.entry ?? defaultOptions.entry
  const exportName = options?.exportName ?? defaultOptions.exportName
  let appDirectory = normalizeAppDirectory(
    options?.appDirectory ?? defaultOptions.appDirectory,
  )

  const appDirectoryPattern = new RegExp(`^${escapeRegExp(appDirectory)}`)

  const plugin: VitePlugin = {
    name: 'remix-express-dev-server',
    configureServer: async server => {
      async function createMiddleware(
        server: ViteDevServer,
      ): Promise<Connect.HandleFunction> {
        return async function (
          req: http.IncomingMessage,
          res: http.ServerResponse,
          next: Connect.NextFunction,
        ): Promise<void> {
          // exclude requests that should be handled by Vite dev server
          const exclude = [
            // ignore requests to the app directory
            appDirectoryPattern,
            /^\/@.+$/,
            /^\/node_modules\/.*/,
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

          let build

          try {
            build = await server.ssrLoadModule(entry)
          } catch (e) {
            return next(e)
          }

          // explicitly typed since express handle function is not exported
          const app = build.entry.module[exportName] as {
            handle: (
              req: http.IncomingMessage,
              res: http.ServerResponse,
              next: Connect.NextFunction,
            ) => void
          }

          if (!app) {
            return next(
              new Error(
                `Failed to find a named export "${exportName}" from ${entry}`,
              ),
            )
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
