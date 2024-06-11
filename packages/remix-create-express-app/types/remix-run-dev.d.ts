declare module '@remix-run/dev/dist/vite/plugin.js' {
  export function setRemixDevLoadContext(
    loadContext: (request: Request) => MaybePromise<Record<string, unknown>>,
  ): void
}
type MaybePromise<T> = T | Promise<T>
