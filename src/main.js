/**
 * WordChain - Main Entry Point
 *
 * Initializes the app:
 * 1. Sets up the SPA router and shows the home page immediately
 * 2. Then authenticates with Supabase in the background
 * 3. Loads profile info once authenticated
 */
import store from './store.js';
import { initRouter, addRoute, navigate } from './router.js';
import { ensureAuth, getProfile } from './supabase.js';

// Lazy-load views for code splitting
// Each loader receives (container, params) and calls the view function with them
const HomeView = (c, p) => import('./views/HomeView.js').then(m => m.default(c, p));
const JoinView = (c, p) => import('./views/JoinView.js').then(m => m.default(c, p));
const LobbyView = (c, p) => import('./views/LobbyView.js').then(m => m.default(c, p));
const PlayView = (c, p) => import('./views/PlayView.js').then(m => m.default(c, p));
const HistoryView = (c, p) => import('./views/HistoryView.js').then(m => m.default(c, p));
const ProfileView = (c, p) => import('./views/ProfileView.js').then(m => m.default(c, p));

async function init() {
  const container = document.getElementById('view-content');
  if (!container) return;

  // --- Register routes ---
  addRoute('/', (c, p) => HomeView(c, p));
  addRoute('/join/:code', (c, p) => JoinView(c, p));
  addRoute('/lobby/:id', (c, p) => LobbyView(c, p));
  addRoute('/play/:id', (c, p) => PlayView(c, p));
  addRoute('/play/solo', (c, p) => PlayView(c, { ...p, id: 'solo' }));
  addRoute('/history', (c, p) => HistoryView(c, p));
  addRoute('/profile', (c, p) => ProfileView(c, p));
  addRoute('/lobby', (c, p) => {
    navigate('/');
    return;
  });

  // --- Profile button (register immediately, not waiting for auth) ---
  const profileBtn = document.getElementById('profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', () => navigate('/profile'));
  }

  // --- Initialize router FIRST so the UI renders immediately ---
  initRouter(container);

  // --- Handle initial navigation ---
  if (!window.location.hash) {
    navigate('/');
  }

  // --- Auth & Profile (background — won't block rendering) ---
  bootstrapAuth();
}

/**
 * Authenticate and load profile in the background.
 * The app works in local/offline mode without auth.
 */
async function bootstrapAuth() {
  try {
    const user = await ensureAuth();
    if (user) {
      store.set('user', user);
      const profile = await getProfile();
      if (profile) {
        store.set('profile', profile);
      }
    }
  } catch (e) {
    // Auth failure is non-fatal — app runs in local/offline mode
    console.warn('Auth background init:', e.message);
  }

}

// Wait for DOM and start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
