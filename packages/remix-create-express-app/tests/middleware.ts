export {}

async function test(
  middleware: any[],
  handleRemixRequest: (...args) => Promise<Response | undefined>,
) {
  let request = new Request('http://localhost:3000/')
  let context = {}
  let params = {}
  let matches = []
  let index = 0

  let lastCaughtError
  let lastCaughtResponse

  // eslint-disable-next-line no-inner-declarations
  // @ts-ignore-next-line
  async function next() {
    try {
      const fn = middleware[index++]
      if (!fn) {
        return await handleRemixRequest(request, context)
      }
      return fn({
        request,
        params,
        context,
        matches,
        // @ts-ignore-next-line
        next,
      })
    } catch (e) {
      // stop middleware
      index = middleware.length
      if (e instanceof Response) {
        console.log(`middleware response`, e.status, e.statusText)
        lastCaughtResponse = e
        return e
      }
      console.log(`middleware error: ${index}`, e.message)
      lastCaughtError = e
    }
  }

  let response
  try {
    // start middleware/remix chain
    response = await next()
  } catch (e) {
    if (e instanceof Response) {
      console.log(`initial response`, e.status, e.statusText)
      lastCaughtResponse = e
      return e
    }
    console.log(`initial error`, e.message)
    lastCaughtError = e
  }

  if (lastCaughtResponse) {
    response = lastCaughtResponse
  }
  if (lastCaughtError) {
    console.error('last caught error:', lastCaughtError.message)
    response = Response.json(lastCaughtError, { status: 500 })
  }

  if (!response) {
    throw new Error('Middleware must return the Response from next()')
  }

  console.log('final response:', response.status, response.statusText)
}

type MiddlewareFunctionArgs = {
  next: () => Promise<Response>
}

function createMiddleware({ name, mode }: { name: string; mode: string }) {
  return async ({ next }: MiddlewareFunctionArgs) => {
    console.log(`middleware enter: ${name}`)
    if (mode === 'error-first') {
      console.log(`throwing error from middleware start ${name}`)
      throw new Error(`from middleware start: ${name}`)
    }
    if (mode === 'redirect-first') {
      console.log(`throwing redirect from middleware start: ${name}`)
      throw Response.redirect('http://localhost/login')
    }
    const response = await next()
    if (mode === 'happy') {
      console.log(`returning response from middleware ${name}`)
      return response
    } else if (mode === 'error') {
      console.log(`throwing error from middleware ${name}`)
      throw new Error(`from middleware: ${name}`)
    } else if (mode === 'redirect') {
      console.log(`throwing redirect from middleware: ${name}`)
      throw Response.redirect('http://localhost/login')
    }
    console.log(`middleware exit: ${name}`)
    return response
  }
}

function createRemixHandler(mode: string) {
  return async (request, context) => {
    console.log(`handle remix request: ${mode}`)
    if (mode === 'happy') {
      console.log('returning JSON response from remix')
      return Response.json({ message: 'from remix' }, { status: 200 })
    } else if (mode === 'error') {
      console.log('throwing error from remix')
      throw new Error('from remix')
    } else if (mode === 'redirect') {
      console.log('throwing redirect from remix')
      throw Response.redirect('/')
    }
  }
}

const happyPathMiddleware = [
  createMiddleware({ name: 'mw1', mode: 'happy' }),
  createMiddleware({ name: 'mw2', mode: 'happy' }),
  createMiddleware({ name: 'mw3', mode: 'happy' }),
]

const happyRemixHandler = createRemixHandler('happy')

console.log('😃 test happy path')
await test(happyPathMiddleware, happyRemixHandler)
console.log('done')

const errorRemixHandler = createRemixHandler('error')

console.log('😢 test error in remix')
await test(happyPathMiddleware, errorRemixHandler)
console.log('done')

const errorInMiddleware = [
  createMiddleware({ name: 'mw1', mode: 'happy' }),
  createMiddleware({ name: 'mw2', mode: 'happy' }),
  createMiddleware({ name: 'mw3', mode: 'error' }),
]

console.log('😢 test error in middleware')
await test(errorInMiddleware, happyRemixHandler)
console.log('done')

const errorInMiddlewareStart = [
  createMiddleware({ name: 'mw1', mode: 'happy' }),
  createMiddleware({ name: 'mw2', mode: 'error-first' }),
  createMiddleware({ name: 'mw3', mode: 'happy' }),
]

console.log('😢 test error in middleware start')
await test(errorInMiddlewareStart, happyRemixHandler)
console.log('done')

const redirectMiddleware = [
  createMiddleware({ name: 'mw1', mode: 'happy' }),
  createMiddleware({ name: 'mw2', mode: 'redirect-first' }),
  createMiddleware({ name: 'mw3', mode: 'happy' }),
]

console.log('↩️ redirect middleware')
await test(redirectMiddleware, happyRemixHandler)
console.log('done')
