import { ServerBuild } from '@remix-run/node'

export type RouteObject = ServerBuild['routes']['root']
export type ReactRouterRouteObject = RouteObject & {
  children: ReactRouterRouteObject[]
}

let routes: ReactRouterRouteObject[]
export function setRoutes(build: ServerBuild) {
  routes = convertRoutes(build.routes)
}
export function getRoutes() {
  return routes
}

// convert Remix routes to React Router routes
function convertRoutes(routes: ServerBuild['routes']) {
  if (!routes) {
    return []
  }

  const routeConfigs = Object.values(routes)

  function getChildren(parentId: string): ReactRouterRouteObject[] {
    return routeConfigs
      .filter(route => route.parentId === parentId)
      .map((route: RouteObject) => {
        return {
          ...route,
          children: getChildren(route.id),
        }
      })
  }
  return [
    { ...routes['root'], children: getChildren('root') },
  ] as ReactRouterRouteObject[]
}
