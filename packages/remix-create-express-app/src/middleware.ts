import { type GetLoadContextFunction } from '@remix-run/express'
import {
  createRemixRequest,
  sendRemixResponse,
} from '@remix-run/express/dist/server.js'
import {
  createRequestHandler as createRemixRequestHandler,
  type AppLoadContext,
  type ServerBuild,
} from '@remix-run/node'
import { matchRoutes } from '@remix-run/react'
import type express from 'express'
import { getRoutes } from './routes.js'

export type MiddlewareFunctionArgs = {
  request: Request
  params: Record<string, string>
  context: AppLoadContext
  matches: ReturnType<typeof matchRoutes>
  next: () => Promise<Response>
}

export type MiddleWareFunction = (
  args: MiddlewareFunctionArgs,
) => Response | undefined

export type Middleware = MiddleWareFunction[]

export type RequestHandler = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => Promise<void>

export function createMiddlewareRequestHandler({
  build,
  getLoadContext,
  mode = process.env.NODE_ENV,
}: {
  build: ServerBuild | (() => Promise<ServerBuild>)
  getLoadContext?: GetLoadContextFunction
  mode?: string
}): RequestHandler {
  const handleRequest = createRemixRequestHandler(build, mode)
  return async (
    req: express.Request,
    res: express.Response,
    expressNext: express.NextFunction,
  ) => {
    try {
      const request = createRemixRequest(req, res)
      const loadContext = await getLoadContext?.(req, res)

      const routes = getRoutes()
      let url = req.url
      let isDataRequest = false
      if (url.endsWith('.data')) {
        isDataRequest = true
        url = url.replace(/\.data$/, '')
      }

      // @ts-expect-error routes type
      const matches = matchRoutes(routes, url) ?? [] // get matches for the url
      const middleware =
        matches
          // @ts-expect-error route module
          .filter(match => match.route?.module['middleware'])
          .flatMap(
            // @ts-expect-error route module
            match => match.route?.module['middleware'] as unknown as Middleware,
          ) ?? []

      const context = loadContext ?? ({} as AppLoadContext)

      let index = 0
      // eslint-disable-next-line no-inner-declarations
      // @ts-ignore-next-line
      async function next() {
        try {
          const fn = middleware[index++]
          if (!fn) {
            return await handleRequest(request, context)
          }
          // @ts-expect-error middleware return type
          return await fn({ request, context, matches, next })
        } catch (e) {
          // stop middleware
          index = middleware.length
          // TODO: handle errors and thrown responses
          // if (e instanceof Error) {
          //   console.error(e)
          //   return new Response(e.message, { status: 500 })
          // } else if (
          //   e instanceof Response &&
          //   e.status >= 300 &&
          //   e.status < 400
          // ) {
          //   throw e
          // }
        }
      }

      let response
      try {
        // start middleware/remix chain
        response = await next()
      } catch (e) {
        console.error('initial next', e)
      }

      if (!response) {
        throw new Error('Middleware must return the Response from next()')
      }
      await sendRemixResponse(res, response)
    } catch (error) {
      // Express doesn't support async functions, so we have to pass along the
      // error manually using next().
      expressNext(error)
    }
  }
}
