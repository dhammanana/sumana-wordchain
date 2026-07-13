/**
 * Hash-based SPA router for GitHub Pages compatibility
 *
 * Routes are defined as hash paths:
 *   #/          - Home / Lobby
 *   #/join/:code - Join a group
 *   #/play/:id  - Game arena
 *   #/lobby/:id - Game lobby / waiting room
 *   #/history   - Game history
 *   #/profile   - User profile
 */

const routes = [];
let currentCleanup = null;

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
 * Initialize the router - call once at app startup
 */
export function initRouter(container) {
  async function handleRoute() {
    // Clean up previous view
    if (currentCleanup) {
      try { currentCleanup(); } catch (e) { console.warn('Cleanup error:', e); }
      currentCleanup = null;
    }

    const match = matchRoute(window.location.hash);

    if (!match) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20">
          <span class="material-symbols-outlined text-6xl text-outline mb-4">search_off</span>
          <h2 class="font-headline-md text-headline-md text-on-surface-variant">Page not found</h2>
          <p class="font-body-md text-body-md text-outline mt-2">This page doesn't exist.</p>
          <a href="#/" class="mt-6 px-6 py-3 bg-primary text-on-primary rounded-xl btn-shadow font-headline-sm">
            Go Home
          </a>
        </div>
      `;
      updateActiveNav('/');
      return;
    }

    // Render the view
    container.innerHTML = '<div class="flex justify-center py-20"><div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>';

    const timeout = setTimeout(() => {
      if (container.querySelector('.animate-spin')) {
        container.innerHTML = `
          <div class="flex flex-col items-center justify-center py-20">
            <span class="material-symbols-outlined text-6xl text-error mb-4">timer_off</span>
            <h2 class="font-headline-md text-headline-md text-on-surface-variant">View timed out</h2>
            <p class="font-body-md text-body-md text-outline mt-2">The page took too long to load. Check the browser console (F12) for errors.</p>
            <button onclick="window.location.hash='#/'" class="mt-6 px-6 py-3 bg-primary text-on-primary rounded-xl btn-shadow font-headline-sm">
              Retry
            </button>
            <pre class="mt-4 p-4 bg-surface-container text-left text-xs rounded-lg overflow-auto max-h-40 text-error" id="timeout-error-display">View render timed out after 10 seconds. Check console for details.</pre>
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
        <div class="flex flex-col items-center justify-center py-20">
          <span class="material-symbols-outlined text-6xl text-error mb-4">error</span>
          <h2 class="font-headline-md text-headline-md text-on-surface-variant">Something went wrong</h2>
          <p class="font-body-md text-body-md text-outline mt-2">${error.message}</p>
          <pre class="mt-4 p-4 bg-surface-container text-left text-xs rounded-lg overflow-auto max-h-40 text-error">${error.stack || 'No stack trace available'}</pre>
          <button onclick="window.location.hash='#/'" class="mt-6 px-6 py-3 bg-primary text-on-primary rounded-xl btn-shadow font-headline-sm">
            Go Home
          </button>
        </div>
      `;
    }

    // Update active nav item
    const routeMatch = matchRoute(window.location.hash);
    updateActiveNav(routeMatch ? routeMatch.path : '/');
  }

  // Listen for hash changes
  window.addEventListener('hashchange', handleRoute);

  // Listen for popstate too (back/forward buttons)
  window.addEventListener('popstate', handleRoute);

  // Initial route
  handleRoute();

  // Return cleanup function
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
 * Update active state of bottom navigation items
 */
function updateActiveNav(currentPath) {
  document.querySelectorAll('.nav-item').forEach(item => {
    const route = item.dataset.route;
    item.classList.toggle('active', currentPath === route || currentPath.startsWith(route));
  });

  // Update top bar profile button visibility
  const profileBtn = document.getElementById('profile-btn');
  if (profileBtn) {
    profileBtn.onclick = () => navigate('/profile');
  }
}
