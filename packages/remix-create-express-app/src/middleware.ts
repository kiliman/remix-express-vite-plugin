import {
  createRemixRequest,
  sendRemixResponse,
  type GetLoadContextFunction,
  createMiddlewareRequest,
} from './remix.js'
import {
  createRequestHandler as createRemixRequestHandler,
  type AppLoadContext,
  type ServerBuild,
} from '@remix-run/node'
import { matchRoutes } from '@remix-run/react'
import type express from 'express'
import { getRoutes } from './routes.js'
import { ServerContext, contextGet, contextSet } from './context.js'

export type MiddlewareFunctionArgs = {
  request: Request
  params: Record<string, string>
  context: AppLoadContext & ServerContext
  matches: ReturnType<typeof matchRoutes>
  next: () => Promise<Response>
}

export type MiddleWareFunction = (args: MiddlewareFunctionArgs) => Response

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
  const handleRemixRequest = createRemixRequestHandler(build, mode)
  return async (
    req: express.Request,
    res: express.Response,
    expressNext: express.NextFunction,
  ) => {
    try {
      const request = createRemixRequest(req, res)

      // need special handling for data requests so middleware functions
      // don't see special data urls
      let url = new URL(req.url, 'http://localhost')
      let isDataRequest = url.pathname.endsWith('.data')
      let isRootData = url.pathname === '/_root.data'
      if (isDataRequest) {
        // rebuild url without .data or index query param
        url.searchParams.delete('index')
        url = new URL(
          (isRootData ? '/' : url.pathname.replace(/\.data$/, '')) + url.search,
          'http://localhost',
        )
        req.url = url.pathname + url.search
      }
      // separate request for middleware functions
      const middlewareRequest = createMiddlewareRequest(req, res)

      // setup server context
      const context = ((await getLoadContext?.(req, res)) ??
        {}) as AppLoadContext & ServerContext
      context.set = contextSet
      context.get = contextGet

      // match routes to determine which middleware to run
      const routes = getRoutes()

      // @ts-expect-error routes type
      let matches = matchRoutes(routes, req.url) ?? [] // get matches for the url
      let leafMatch = matches.at(-1)
      if (isRootData) {
        // just return the root route
        matches = [matches[0]]
        leafMatch = matches[0]
      }

      const middleware =
        matches
          // @ts-expect-error route module
          .filter(match => match.route?.module['middleware'])
          .flatMap(
            // @ts-expect-error route module
            match => match.route?.module['middleware'] as unknown as Middleware,
          ) ?? []

      let index = 0
      let lastCaughtResponse
      let lastCaughtError

      // eslint-disable-next-line no-inner-declarations
      // @ts-ignore-next-line
      async function next() {
        try {
          const fn = middleware[index++]
          if (!fn) {
            return await handleRemixRequest(request, context)
          }
          return fn({
            request: middlewareRequest,
            params: (leafMatch?.params ?? {}) as Record<string, string>,
            context,
            matches,
            // @ts-ignore-next-line
            next,
          })
        } catch (e) {
          // stop middleware
          index = middleware.length
          if (e instanceof Response) {
            lastCaughtResponse = e
          } else {
            lastCaughtError = e
          }
        }
      }

      let response
      try {
        // start middleware/remix chain
        response = await next()
      } catch (e) {
        if (e instanceof Response) {
          lastCaughtResponse = e
        } else {
          lastCaughtError = e
        }
      }
      if (lastCaughtResponse) {
        response = lastCaughtResponse
      }
      if (lastCaughtError) {
        response = Response.json(lastCaughtError, { status: 500 })
      }

      if (!response) {
        throw new Error('Middleware must return the Response from next()')
      }

      const isRedirect = isRedirectResponse(response)
      if (isDataRequest && isRedirect) {
        const status = response.status
        const location = response.headers.get('Location')
        // HACK to get correct turbo-stream response
        // I'll figure this out later
        let body = `[["SingleFetchRedirect",1],{"2":3,"4":5,"6":7,"8":7},"redirect","${location}","status",${status},"revalidate",false,"reload"]`

        response = new Response(body, {
          status: 200,
          headers: (response as unknown as Response).headers,
        })
        response.headers.set('Content-Type', 'text/x-turbo; charset=utf-8')
        response.headers.set('X-Remix-Response', 'yes')
        response.headers.delete('Location')
      }

      await sendRemixResponse(res, response as unknown as Response)
    } catch (error) {
      // Express doesn't support async functions, so we have to pass along the
      // error manually using next().
      expressNext(error)
    }
  }
}

function isRedirectResponse(response: Response) {
  return response.status >= 300 && response.status < 400
}
