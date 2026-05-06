# CHANGELOG

## v0.4.7

- 🐛 Stash outer Vite dev server on `globalThis` so `remix-create-express-app`
  can reuse it instead of spinning up a parallel SSR runtime. Fixes a latent
  dual-evaluation bug where `entry.server.tsx` (and its transitive imports)
  evaluated twice with separate module-level state, silently breaking any
  library that patches globals at module init (MSW, Sentry HTTP
  instrumentation, OTel). Pair with `remix-create-express-app@0.4.7` or later
  to take effect; older consumers continue to work unchanged.

## v0.4.6

- ✨ Add `vitePaths` option in `expressDevServer` plugin

## v0.4.5

- 🐛 Move `configure` call before default middleware

## v0.4.4

- 🐛 Ensure remix SSR module is loaded

## v0.4.0

- 🐛 Ensure module is ready before accessing [#27]
- ✨ Add support for app Promise
- 🔨 Ensure plugin runs at end via `enforce: post`

## v0.2.7

- 🐛 Use the moduleGraph to load the server entry point so that we don't call and transform the remix entry server twice [#25]

## v0.2.6

- 🐛 Move minimatch to a dependency [#22]

## v0.2.5

- ✨ Add `configureServer` option in `expressDevServer` plugin [#6]

## v0.2.4

- 🐛 Check to see if physical file exists and send to Vite [#12]

## v0.2.2

- 🔥 Remove console.log

## v0.2.1

- 🐛 Add appDirectory config to support non-app folder [#11]

## v0.2.0

- 🚨 Breaking Change: split package into two separate packages
- 🔥 Remove the Remix Vite `expressPreset`

## v0.1.1

- 🐛 Cannot find build/server/remix.js [#1]

## v0.1.0

- 🎉 Initial commit
