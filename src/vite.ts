import { Preset } from '@remix-run/dev'
import type http from 'node:http'
import { minimatch } from 'minimatch'
import type { Plugin as VitePlugin, ViteDevServer, Connect } from 'vite'
import * as esbuild from 'esbuild'

export type DevServerOptions = {
  entry?: string
  ignoreWatching?: (string | RegExp)[]
}

export const defaultOptions: Required<DevServerOptions> = {
  entry: './server/index.ts',
  ignoreWatching: [],
}

export type Fetch = (request: Request) => Promise<Response>

export function expressDevServer(options?: DevServerOptions): VitePlugin {
  const entry = options?.entry ?? defaultOptions.entry
  const plugin: VitePlugin = {
    name: '@kiliman/vite-express-server',
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

          let appModule

          try {
            appModule = await server.ssrLoadModule(entry)
          } catch (e) {
            return next(e)
          }

          const exportName = 'default'
          // explicitly typed since express handle function is not exported
          const app = appModule[exportName] as {
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
    config: () => {
      return {
        server: {
          watch: {
            ignored: options?.ignoreWatching ?? defaultOptions.ignoreWatching,
          },
        },
      }
    },
  }
  return plugin
}

export function expressPreset(): Preset {
  return {
    name: 'express-preset',
    remixConfig: () => ({
      serverBuildFile: 'remix.js',
      buildEnd: async () => {
        await esbuild
          .build({
            alias: { '~': './app' },
            sourcemap: true,
            // The final file name
            outfile: 'build/server/index.js',
            // Our server entry point
            entryPoints: ['server/index.ts'],
            // Dependencies that should not be bundled
            // We import the remix build from "../build/server/remix.js", so no need to bundle it again
            external: ['./build/server/*'],
            platform: 'node',
            format: 'esm',
            // Don't include node_modules in the bundle
            packages: 'external',
            bundle: true,
            logLevel: 'info',
          })
          .catch((error: unknown) => {
            console.error(error)
            process.exit(1)
          })
      },
    }),
  }
}
