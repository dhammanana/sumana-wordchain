import store from '../store.js';
import { navigate } from '../router.js';
import { supabase, signOut, getCurrentUser, getProfile, upsertProfile } from '../supabase.js';
import { showToast, updateUserBadge } from '../utils/ui.js';

/**
 * ProfileView - User profile, stats, and settings
 */
export default async function ProfileView(container) {
  store.set('currentView', '/profile');
  const user = store.get('user');
  const profile = store.get('profile');

  container.innerHTML = `
    <div class="flex flex-col gap-5 pb-28 animate-fade-in-up">
      ${!user ? `
        <!-- Not signed in -->
        <div class="glass-card p-8 text-center">
          <div class="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
            <span class="material-symbols-outlined text-3xl text-primary" style="font-variation-settings:'FILL'1">person</span>
          </div>
          <h2 class="font-heading text-heading-md text-dark-text mb-2">Sign in to see your profile</h2>
          <p class="text-body-sm text-dark-text-muted mb-6">Track your progress, view stats, and more.</p>
          <a href="#/" class="inline-block px-8 py-3.5 btn-primary text-body-md">Go to Home</a>
        </div>
      ` : `
        <!-- Profile Card -->
        <div class="glass-card p-6 text-center relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none"></div>
          <div class="relative z-10">
            <div class="w-20 h-20 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4 overflow-hidden">
              ${profile?.avatar_url
                ? `<img src="${profile.avatar_url}" alt="" class="w-full h-full object-cover" />`
                : `<span class="material-symbols-outlined text-3xl text-primary" style="font-variation-settings:'FILL'1">person</span>`
              }
            </div>
            <h2 class="font-heading text-heading-md text-dark-text">${profile?.display_name || 'Player'}</h2>
            <p class="text-body-sm text-dark-text-muted mt-1">${profile?.email || ''}</p>
            <p class="text-label-sm text-dark-text-muted mt-1">${profile?.provider ? `Signed in with ${profile.provider}` : ''}</p>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-3 gap-3">
          <div class="glass-card p-4 text-center">
            <div class="w-10 h-10 rounded-xl bg-warning-container flex items-center justify-center mx-auto mb-2">
              <span class="material-symbols-outlined text-lg text-warning">diamond</span>
            </div>
            <p class="font-heading text-heading-sm text-dark-text font-bold">${profile?.gems || 0}</p>
            <p class="text-label-sm text-dark-text-muted">Gems</p>
          </div>
          <div class="glass-card p-4 text-center">
            <div class="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-2">
              <span class="material-symbols-outlined text-lg text-primary">trophy</span>
            </div>
            <p class="font-heading text-heading-sm text-dark-text font-bold">${profile?.total_score || 0}</p>
            <p class="text-label-sm text-dark-text-muted">Score</p>
          </div>
          <div class="glass-card p-4 text-center">
            <div class="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mx-auto mb-2">
              <span class="material-symbols-outlined text-lg text-accent">local_fire_department</span>
            </div>
            <p class="font-heading text-heading-sm text-dark-text font-bold">${profile?.total_days_active || 0}</p>
            <p class="text-label-sm text-dark-text-muted">Days</p>
          </div>
        </div>

        <!-- More Stats -->
        <div id="more-stats" class="glass-card p-5 space-y-3">
          <h3 class="font-heading text-heading-sm text-dark-text flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">analytics</span>
            Activity
          </h3>
          <div id="stats-loading" class="flex items-center justify-center py-4">
            <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div id="stats-content" class="hidden space-y-3">
            <div class="flex items-center justify-between p-3 rounded-lg bg-glass">
              <span class="text-body-sm text-dark-text-muted">Games Played</span>
              <span id="stat-games" class="font-heading text-heading-sm text-dark-text font-bold">--</span>
            </div>
            <div class="flex items-center justify-between p-3 rounded-lg bg-glass">
              <span class="text-body-sm text-dark-text-muted">Wins</span>
              <span id="stat-wins" class="font-heading text-heading-sm text-primary font-bold">--</span>
            </div>
            <div class="flex items-center justify-between p-3 rounded-lg bg-glass">
              <span class="text-body-sm text-dark-text-muted">Losses</span>
              <span id="stat-losses" class="font-heading text-heading-sm text-error font-bold">--</span>
            </div>
            <div class="flex items-center justify-between p-3 rounded-lg bg-glass">
              <span class="text-body-sm text-dark-text-muted">Total Words</span>
              <span id="stat-words" class="font-heading text-heading-sm text-dark-text font-bold">--</span>
            </div>
            <div class="flex items-center justify-between p-3 rounded-lg bg-glass">
              <span class="text-body-sm text-dark-text-muted">Gems Earned</span>
              <span id="stat-gems-earned" class="font-heading text-heading-sm text-warning font-bold">--</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="glass-card p-5 space-y-2">
          <h3 class="font-heading text-heading-sm text-dark-text flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-primary">settings</span>
            Settings
          </h3>
          <button id="sign-out-btn" class="w-full flex items-center justify-between p-3 rounded-xl bg-glass hover:bg-glass-light transition-all text-left">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-error">logout</span>
              <span class="text-body-sm text-dark-text">Sign Out</span>
            </div>
            <span class="material-symbols-outlined text-dark-text-muted text-sm">chevron_right</span>
          </button>
        </div>
      `}
    </div>
  `;

  if (!user) return;

  // Load stats
  loadStats(user.id, profile);

  // Sign out
  container.querySelector('#sign-out-btn').addEventListener('click', async () => {
    if (confirm('Sign out of WordChain?')) {
      try {
        await signOut();
        store.set('user', null);
        store.set('profile', null);
        updateUserBadge();
        showToast('success', 'Signed out successfully.');
        navigate('/');
      } catch (error) {
        showToast('error', error.message);
      }
    }
  });
}

async function loadStats(userId, profile) {
  try {
    const [gameCountResult, wordCountResult, totalScoreResult] = await Promise.all([
      supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('player_id', userId),
      supabase.from('game_words').select('*', { count: 'exact', head: true }).eq('player_id', userId),
      supabase.rpc('get_total_score', { user_id_param: userId }).catch(() => ({ data: null })),
    ]);

    const gameCount = gameCountResult.count || 0;
    const wordCount = wordCountResult.count || 0;
    const totalScore = profile?.total_score || 0;

    document.getElementById('stats-loading').classList.add('hidden');
    document.getElementById('stats-content').classList.remove('hidden');
    document.getElementById('stat-games').textContent = gameCount;
    document.getElementById('stat-wins').textContent = profile?.games_won || 0;
    document.getElementById('stat-losses').textContent = profile?.games_lost || 0;
    document.getElementById('stat-words').textContent = wordCount;
    document.getElementById('stat-gems-earned').textContent = Math.floor(totalScore / 100);

  } catch (e) {
    const loading = document.getElementById('stats-loading');
    if (loading) {
      loading.innerHTML = '<p class="text-body-sm text-dark-text-muted">Could not load stats.</p>';
    }
  }
}