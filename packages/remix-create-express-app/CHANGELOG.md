# CHANGELOG

## v0.4.7

- 🐛 Reuse the outer Vite dev server (stashed by `remix-express-dev-server` on
  `globalThis`) instead of always creating a new one. Eliminates a parallel
  SSR runtime that caused `entry.server.tsx` (and its transitive imports) to
  evaluate twice with separate module-level state, silently breaking any
  library that patches globals at module init (MSW, Sentry HTTP
  instrumentation, OTel). Standalone usage (without `remix-express-dev-server`)
  still falls back to creating its own dev server, so this is non-breaking.

## v0.4.5

- 🐛 Move `configure` call before default middleware

## v0.4.4

- 🔥 Remove context hack

## v0.4.3

- 🐛 Dynamically import setRemixDevLoadContext in development only

## v0.4.2

- 🐛 Fix import reference

## v0.4.1

- 🐛 Ensure Vite plugin uses specified getLoadContext for SSR+HMR

## v0.4.0

- ✨ `createExpressApp` now supports `async` for configuration

## v0.3.12

- ↩️ Revert "Prevent duplicate calls to createExpressApp but still support HMR [#24]"

## v0.3.11

- 🐛 Modify request.url with originalUrl [#23]
- 🐛 Prevent duplicate calls to createExpressApp but still support HMR [#24]
- 🐛 Use `x-forwarded-host` for resolved hostname

## v0.3.10

- ~~🐛 Move minimatch to a dependency [#22]~~

## v0.3.9

- 🐛 Move minimatch to a dependency [#22]

## v0.3.8

- ✨ Add buildDirectory and serverBuildFile as options to CreateExpressAppArgs [#21]
- 🐛 Support for partial data requests
- 🐛 Run all matching middleware even for just root data requests [#19]
- 🐛 Modify originalUrl to strip data url for middleware requests

## v0.3.7

- 🐛 Handle data requests with search params [#14]

## v0.3.6

- ✨ Add new ServerContext API

## v0.3.5

- ✨ Add redirect support from middleware

## v0.3.4

- 🔨 Make createExpressApp args optional

## v0.3.3

- 🔨 Middleware function must return a response or throw
- 🐛 Add `params` object to middleware function call [#7]
- 🐛 Ignore headers that start with `:` from http2 [#10]

## v0.3.2

- 🐛 Fix import of production build on Windows [#9]
- ✨ Create default app similar to Remix App Server if no configure provided
- ✨ Pass the Remix ServerBuild to the getLoadContext function

## v0.3.1

- 🐛 Fix package build: "Cannot find module" ESM is hard! [#4]

## v0.3.0

- ✨ Add Remix Middleware support

## v0.2.0

- 🚨 Breaking Change: split package into two separate packages
- ✨ Add support for custom servers and express module
- ✨ Add support for custom request handlers

## v0.1.1

- 🐛 Cannot find build/server/remix.js [#1]

## v0.1.0

- 🎉 Initial commit
