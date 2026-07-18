/**
 * WordChain - Main Entry Point
 */
import store from './store.js';
import { initRouter, addRoute, navigate, rerenderCurrentRoute } from './router.js';
import { supabase, getCurrentUser, getProfile, getSession } from './supabase.js';
import { updateUserBadge } from './utils/ui.js';

const HomeView = (c, p) => import('./views/HomeView.js').then(m => m.default(c, p));
const JoinView = (c, p) => import('./views/JoinView.js').then(m => m.default(c, p));
const LobbyView = (c, p) => import('./views/LobbyView.js').then(m => m.default(c, p));
const PlayView = (c, p) => import('./views/PlayView.js').then(m => m.default(c, p));
const HistoryView = (c, p) => import('./views/HistoryView.js').then(m => m.default(c, p));
const ProfileView = (c, p) => import('./views/ProfileView.js').then(m => m.default(c, p));

async function init() {
  const container = document.getElementById('view-content');
  if (!container) return;

  // Register routes
  addRoute('/', (c, p) => HomeView(c, p));
  addRoute('/join/:code', (c, p) => JoinView(c, p));
  addRoute('/lobby/:id', (c, p) => LobbyView(c, p));
  addRoute('/play/:id', (c, p) => PlayView(c, p));
  addRoute('/play/solo', (c, p) => PlayView(c, { ...p, id: 'solo' }));
  addRoute('/history', (c, p) => HistoryView(c, p));
  addRoute('/profile', (c, p) => ProfileView(c, p));
  addRoute('/lobby', () => navigate('/'));

  // Profile button
  const profileBtn = document.getElementById('profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', () => navigate('/profile'));
  }

  // Restore session on startup BEFORE rendering any view, so a logged-in
  // user is recognised immediately (otherwise HomeView renders the login
  // screen on first paint and never re-renders).
  try {
    const session = await getSession();
    if (session?.user && !session.user.is_anonymous) {
      store.set('user', session.user);
      const { ensureProfile } = await import('./supabase.js');
      const profile = await ensureProfile();
      if (profile) {
        store.set('profile', profile);
        try {
          const { trackActivity } = await import('./supabase.js');
          await trackActivity();
        } catch (e) {}
      }
      updateUserBadge();
    } else {
      store.set('user', null);
      store.set('profile', null);
    }
  } catch (e) {
    console.warn('Session restore:', e.message);
  }

  // Listen for auth state changes (login / logout / token refresh)
  supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user;
    if (user && !user.is_anonymous) {
      store.set('user', user);
      // ensureProfile is async; refresh profile + re-render after it resolves
      import('./supabase.js').then(async ({ ensureProfile, trackActivity }) => {
        const profile = await ensureProfile();
        if (profile) {
          store.set('profile', profile);
          try { await trackActivity(); } catch (e) {}
        }
        updateUserBadge();
        // Re-render the active view so ANY view (not just HomeView) reflects
        // the new auth state in place.
        rerenderCurrentRoute();
      });
    } else {
      store.set('user', null);
      store.set('profile', null);
      updateUserBadge();
      rerenderCurrentRoute();
    }
  });

  // Initialize router (after session is restored)
  initRouter(container);

  // Handle initial navigation
  if (!window.location.hash) {
    navigate('/');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
