import type http from 'node:http'
import { minimatch } from 'minimatch'
import type { Connect, Plugin as VitePlugin, ViteDevServer } from 'vite'

export type DevServerOptions = {
  entry?: string
  exportName?: string
}

export const defaultOptions: Required<DevServerOptions> = {
  entry: 'virtual:remix/server-build',
  exportName: 'app',
}

export type Fetch = (request: Request) => Promise<Response>

export function expressDevServer(options?: DevServerOptions): VitePlugin {
  const entry = options?.entry ?? defaultOptions.entry
  const exportName = options?.exportName ?? defaultOptions.exportName

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
          const exclude = [/^\/(app)\/.+/, /^\/@.+$/, /^\/node_modules\/.*/]

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
