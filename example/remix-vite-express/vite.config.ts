import { vitePlugin as remix } from '@remix-run/dev'
import { installGlobals } from '@remix-run/node'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { expressDevServer } from 'remix-express-dev-server'

installGlobals()

export default defineConfig({
  build: {
    target: 'esnext',
  },
  plugins: [expressDevServer(), remix(), tsconfigPaths()],
})
