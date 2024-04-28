import {
  type GetLoadContextFunction,
  createRequestHandler,
} from '@remix-run/express'
import { type ServerBuild } from '@remix-run/node'
import express from 'express'
import { type Application } from 'express'
import sourceMapSupport from 'source-map-support'
import url from 'node:url'
import fs from 'node:fs'

export type CreateExpressAppArgs = {
  configure?: (app: Application) => void
  getLoadContext?: GetLoadContextFunction
}
export function createExpressApp({
  configure,
  getLoadContext,
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

  const app = express()

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

  // handle SSR requests
  app.all('*', async (req, res, next) => {
    const build = (isProductionMode
      ? // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // eslint-disable-next-line import/no-unresolved -- this expected until you build the app
        await import(process.cwd() + '/build/server/remix.js')
      : await importDevBuild()) as unknown as ServerBuild

    return createRequestHandler({ build, mode, getLoadContext })(req, res, next)
  })

  const port = process.env.PORT || 3000

  if (isProductionMode) {
    app.listen(port, () =>
      console.log(`Express server listening at http://localhost:${port}`),
    )
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

function importDevBuild() {
  return viteDevServer?.ssrLoadModule('virtual:remix/server-build')
}
