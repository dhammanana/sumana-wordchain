/**
 * Hash-based SPA router for GitHub Pages compatibility
 */

const routes = [];
let currentCleanup = null;
let currentHandleRoute = null;

/**
 * Register a route
 */
export function addRoute(pattern, view) {
  routes.push({ pattern, view });
}

/**
 * Match a hash against registered patterns
 */
function matchRoute(hash) {
  const path = hash.replace(/^#/, '') || '/';

  for (const route of routes) {
    const paramNames = [];
    const regexStr = route.pattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = new RegExp(`^${regexStr}$`);
    const match = path.match(regex);

    if (match) {
      const params = {};
      paramNames.forEach((name, index) => {
        params[name] = decodeURIComponent(match[index + 1]);
      });
      return { view: route.view, params, path };
    }
  }

  return null;
}

/**
 * Navigate to a hash route
 */
export function navigate(hash) {
  window.location.hash = hash.startsWith('#') ? hash : `#${hash}`;
}

/**
 * Get current hash path
 */
export function getCurrentPath() {
  const hash = window.location.hash || '#/';
  return hash.replace(/^#/, '') || '/';
}

/**
 * Initialize the router
 */
export function initRouter(container) {
  async function handleRoute() {
    if (currentCleanup) {
      try { currentCleanup(); } catch (e) { console.warn('Cleanup error:', e); }
      currentCleanup = null;
    }

    const match = matchRoute(window.location.hash);

    if (!match) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 animate-fade-in">
          <div class="w-20 h-20 rounded-2xl bg-error-container flex items-center justify-center mb-6">
            <span class="material-symbols-outlined text-4xl text-error">search_off</span>
          </div>
          <h2 class="font-heading text-heading-md text-dark-text mb-2">Page not found</h2>
          <p class="text-body-md text-dark-text-muted mb-8">This page doesn't exist.</p>
          <a href="#/" class="px-8 py-3.5 btn-primary text-body-md">
            Go Home
          </a>
        </div>
      `;
      updateActiveNav('/');
      return;
    }

    // Loading state
    container.innerHTML = `
      <div class="flex justify-center py-20">
        <div class="flex flex-col items-center gap-4">
          <div class="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin"></div>
          <span class="text-body-sm text-dark-text-muted">Loading...</span>
        </div>
      </div>
    `;

    const timeout = setTimeout(() => {
      if (container.querySelector('.animate-spin')) {
        container.innerHTML = `
          <div class="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div class="w-20 h-20 rounded-2xl bg-warning-container flex items-center justify-center mb-6">
              <span class="material-symbols-outlined text-4xl text-warning">timer_off</span>
            </div>
            <h2 class="font-heading text-heading-md text-dark-text mb-2">View timed out</h2>
            <p class="text-body-md text-dark-text-muted mb-2">The page took too long to load.</p>
            <button onclick="window.location.hash='#/'" class="px-8 py-3.5 btn-primary text-body-md mt-4">
              Retry
            </button>
          </div>
        `;
      }
    }, 10000);

    try {
      const cleanup = await match.view(container, match.params);
      clearTimeout(timeout);
      if (typeof cleanup === 'function') {
        currentCleanup = cleanup;
      }
    } catch (error) {
      clearTimeout(timeout);
      console.error('View render error:', error);
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 animate-fade-in">
          <div class="w-20 h-20 rounded-2xl bg-error-container flex items-center justify-center mb-6">
            <span class="material-symbols-outlined text-4xl text-error">error</span>
          </div>
          <h2 class="font-heading text-heading-md text-dark-text mb-2">Something went wrong</h2>
          <p class="text-body-md text-dark-text-muted mb-4">${error.message}</p>
          <pre class="max-w-lg mb-6 p-4 bg-glass rounded-xl text-body-sm text-error/80 overflow-auto max-h-40">${error.stack || ''}</pre>
          <button onclick="window.location.hash='#/'" class="px-8 py-3.5 btn-primary text-body-md">
            Go Home
          </button>
        </div>
      `;
    }

    const routeMatch = matchRoute(window.location.hash);
    updateActiveNav(routeMatch ? routeMatch.path : '/');
  }

  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('popstate', handleRoute);

  currentHandleRoute = handleRoute;
  handleRoute();

  return () => {
    window.removeEventListener('hashchange', handleRoute);
    window.removeEventListener('popstate', handleRoute);
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }
  };
}

/**
 * Re-run the current route's view. Used when global state (e.g. auth/session)
 * changes and the active view needs to re-render in place. Safe to call before
 * the router is initialized (it becomes a no-op until initRouter runs).
 */
export function rerenderCurrentRoute() {
  if (currentHandleRoute) currentHandleRoute();
}

function updateActiveNav(currentPath) {
  document.querySelectorAll('.nav-item').forEach(item => {
    const route = item.dataset.route;
    item.classList.toggle('active', currentPath === route || currentPath.startsWith(route));
  });
}
