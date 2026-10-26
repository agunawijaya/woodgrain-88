/**
 * Hash routing, so the site works from any static host (GitHub Pages) and the
 * browser's Back button moves between the Den, the list, a game and its play
 * screen. Query parameters on play routes carry the channel, run mode,
 * cartridge version and challenge links; a game route may carry the version.
 */
export type Route =
  | { name: 'den' }
  | { name: 'list' }
  | { name: 'game'; id: string; version?: string }
  | { name: 'play'; id: string; params: URLSearchParams }
  | { name: 'records' }
  | { name: 'about' }
  | { name: 'not-found'; hash: string };

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path = '/', query = ''] = raw.split('?', 2);
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'den' };
  const [head, id] = parts;
  if (parts.length === 1 && head === 'list') return { name: 'list' };
  if (parts.length === 1 && head === 'records') return { name: 'records' };
  if (parts.length === 1 && head === 'about') return { name: 'about' };
  if (parts.length === 2 && id !== undefined && ID.test(id)) {
    if (head === 'game') {
      const version = new URLSearchParams(query).get('version');
      return version !== null && ID.test(version) ? { name: 'game', id, version } : { name: 'game', id };
    }
    if (head === 'play') return { name: 'play', id, params: new URLSearchParams(query) };
  }
  return { name: 'not-found', hash };
}

export function routeHash(route: Route): string {
  switch (route.name) {
    case 'den':
      return '#/';
    case 'list':
      return '#/list';
    case 'records':
      return '#/records';
    case 'about':
      return '#/about';
    case 'game':
      return `#/game/${route.id}${route.version ? `?version=${route.version}` : ''}`;
    case 'play': {
      const query = route.params.toString();
      return `#/play/${route.id}${query ? `?${query}` : ''}`;
    }
    case 'not-found':
      return route.hash;
  }
}

export interface Router {
  current(): Route;
  go(route: Route, options?: { replace?: boolean }): void;
  back(): void;
  dispose(): void;
}

export function createRouter(onChange: (route: Route) => void): Router {
  const handle = () => onChange(parseRoute(location.hash));
  window.addEventListener('hashchange', handle);
  return {
    current: () => parseRoute(location.hash),
    go(route, options = {}) {
      const hash = routeHash(route);
      if (hash === location.hash) return;
      if (options.replace) {
        history.replaceState(null, '', hash);
        handle();
      } else {
        location.hash = hash;
      }
    },
    back() {
      history.back();
    },
    dispose() {
      window.removeEventListener('hashchange', handle);
    },
  };
}
