/**
 * ProfileView - User profile and settings
 *
 * Shows/edit:
 * - Display name
 * - Avatar
 * - Theme preference
 * - Game stats (optional)
 */
import store from '../store.js';
import { navigate } from '../router.js';
import { ensureAuth, getProfile, upsertProfile, supabase } from '../supabase.js';
import { showToast } from '../utils/ui.js';

export default async function ProfileView(container, params) {
  store.set('currentView', '/profile');

  container.innerHTML = `
    <div class="flex flex-col gap-gap-lg pb-28">
      <!-- Header -->
      <div>
        <h2 class="font-headline-md text-headline-md">Profile</h2>
        <p class="font-body-md text-body-md text-on-surface-variant">Manage your player settings.</p>
      </div>

      <!-- Loading -->
      <div id="profile-loading" class="flex flex-col items-center justify-center py-20">
        <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="font-body-md text-body-md text-on-surface-variant">Loading profile...</p>
      </div>

      <!-- Profile Content -->
      <div id="profile-content" class="hidden space-y-gap-lg animate-slide-up">
        <!-- Avatar Section -->
        <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg">
          <div class="flex flex-col items-center gap-gap-md mb-gap-lg">
            <div class="relative group">
              <div class="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-surface-container-high overflow-hidden bg-surface-container">
                <div id="profile-avatar" class="w-full h-full bg-primary text-on-primary flex items-center justify-center font-display-lg text-display-lg-mobile">
                  ?
                </div>
              </div>
              <label class="absolute inset-0 bg-on-background/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full" for="profile-avatar-seed">
                <span class="material-symbols-outlined text-surface text-2xl">refresh</span>
              </label>
            </div>
            <input type="hidden" id="profile-avatar-seed" value="default" />
            <button id="shuffle-avatar-btn" class="text-sm text-primary font-label-caps text-label-caps hover:underline flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">shuffle</span>
              Randomize Avatar
            </button>
          </div>

          <!-- Name -->
          <div class="flex flex-col gap-xs mb-gap-md">
            <label class="font-label-caps text-label-caps text-on-surface-variant ml-1" for="profile-name">DISPLAY NAME</label>
            <input id="profile-name" type="text" maxlength="20" placeholder="Enter your nickname..."
              class="w-full px-gap-md py-4 rounded-xl border-2 border-outline-variant bg-surface-container-low font-input-text text-input-text focus:border-primary focus:ring-0 transition-all outline-none" />
          </div>

          <!-- Theme -->
          <div class="flex flex-col gap-xs mb-gap-md">
            <p class="font-label-caps text-label-caps text-on-surface-variant ml-1">THEME</p>
            <div class="flex flex-wrap gap-sm">
              <button class="theme-chip px-gap-md py-gap-sm rounded-full bg-secondary-container text-on-secondary-container border border-secondary font-label-caps text-label-caps flex items-center gap-xs pressed-state transition-all" data-theme="emerald">
                <span class="material-symbols-outlined text-sm" style="font-variation-settings:'FILL'1">circle</span>
                Emerald
              </button>
              <button class="theme-chip px-gap-md py-gap-sm rounded-full bg-surface-container border border-outline-variant text-on-surface-variant font-label-caps text-label-caps flex items-center gap-xs pressed-state transition-all hover:bg-surface-container-high" data-theme="ocean">
                <span class="material-symbols-outlined text-sm">circle</span>
                Ocean
              </button>
              <button class="theme-chip px-gap-md py-gap-sm rounded-full bg-surface-container border border-outline-variant text-on-surface-variant font-label-caps text-label-caps flex items-center gap-xs pressed-state transition-all hover:bg-surface-container-high" data-theme="sunset">
                <span class="material-symbols-outlined text-sm">circle</span>
                Sunset
              </button>
              <button class="theme-chip px-gap-md py-gap-sm rounded-full bg-surface-container border border-outline-variant text-on-surface-variant font-label-caps text-label-caps flex items-center gap-xs pressed-state transition-all hover:bg-surface-container-high" data-theme="midnight">
                <span class="material-symbols-outlined text-sm">circle</span>
                Midnight
              </button>
              <button class="theme-chip px-gap-md py-gap-sm rounded-full bg-surface-container border border-outline-variant text-on-surface-variant font-label-caps text-label-caps flex items-center gap-xs pressed-state transition-all hover:bg-surface-container-high" data-theme="coral">
                <span class="material-symbols-outlined text-sm">circle</span>
                Coral
              </button>
            </div>
          </div>

          <!-- Save Button -->
          <button id="save-profile-btn" class="w-full py-4 bg-primary text-on-primary font-headline-sm text-headline-sm rounded-xl btn-shadow transition-all flex items-center justify-center gap-md">
            <span class="material-symbols-outlined" style="font-variation-settings:'FILL'1">save</span>
            Save Profile
          </button>
        </div>

        <!-- Stats Card -->
        <div class="bg-gradient-to-r from-primary-container/5 to-secondary-container/5 border border-outline-variant rounded-2xl p-gap-lg">
          <h3 class="font-headline-sm text-headline-sm flex items-center gap-2 mb-gap-md">
            <span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL'1">bar_chart</span>
            Your Stats
          </h3>
          <div class="grid grid-cols-2 gap-gap-md">
            <div class="bg-surface-container rounded-xl p-gap-md text-center">
              <span class="material-symbols-outlined text-primary text-2xl mb-1">games</span>
              <p class="font-headline-sm text-headline-sm font-bold text-primary" id="stat-games">0</p>
              <p class="font-label-caps text-label-caps text-outline">Games</p>
            </div>
            <div class="bg-surface-container rounded-xl p-gap-md text-center">
              <span class="material-symbols-outlined text-primary text-2xl mb-1">abc</span>
              <p class="font-headline-sm text-headline-sm font-bold text-primary" id="stat-words">0</p>
              <p class="font-label-caps text-label-caps text-outline">Words</p>
            </div>
            <div class="bg-surface-container rounded-xl p-gap-md text-center">
              <span class="material-symbols-outlined text-secondary text-2xl mb-1">emoji_events</span>
              <p class="font-headline-sm text-headline-sm font-bold text-secondary" id="stat-score">0</p>
              <p class="font-label-caps text-label-caps text-outline">Total Score</p>
            </div>
            <div class="bg-surface-container rounded-xl p-gap-md text-center">
              <span class="material-symbols-outlined text-tertiary text-2xl mb-1">electric_bolt</span>
              <p class="font-headline-sm text-headline-sm font-bold text-tertiary" id="stat-streak">0</p>
              <p class="font-label-caps text-label-caps text-outline">Longest Chain</p>
            </div>
          </div>
        </div>

        <!-- Account Info -->
        <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg">
          <h3 class="font-headline-sm text-headline-sm mb-gap-md">Account</h3>
          <div class="space-y-gap-md">
            <div class="flex items-center justify-between p-gap-md bg-surface-container rounded-xl">
              <span class="font-body-md text-body-md">User ID</span>
              <span class="font-label-caps text-label-caps text-outline font-mono text-xs" id="user-id-display">---</span>
            </div>
            <div class="flex items-center justify-between p-gap-md bg-surface-container rounded-xl">
              <span class="font-body-md text-body-md">Auth Type</span>
              <span class="font-label-caps text-label-caps text-outline">Anonymous</span>
            </div>
            <div class="flex items-center justify-between p-gap-md bg-surface-container rounded-xl">
              <span class="font-body-md text-body-md">App Version</span>
              <span class="font-label-caps text-label-caps text-outline">1.0.0</span>
            </div>
          </div>
        </div>

        <!-- Sign Out -->
        <button id="signout-btn" class="w-full py-3 text-outline font-label-caps text-label-caps hover:text-error transition-colors flex items-center justify-center gap-2">
          <span class="material-symbols-outlined text-sm">logout</span>
          Sign Out
        </button>
      </div>

      <!-- Error state -->
      <div id="profile-error" class="hidden text-center py-16">
        <span class="material-symbols-outlined text-5xl text-error mb-3">error</span>
        <p class="font-body-md text-body-md text-on-surface-variant" id="profile-error-msg">Could not load profile.</p>
        <button id="retry-btn" class="mt-4 px-6 py-3 bg-primary text-on-primary rounded-xl btn-shadow">Try Again</button>
      </div>
    </div>
  `;

  try {
    const user = await ensureAuth();
    if (!user) throw new Error('Not authenticated');

    // Show user ID
    container.querySelector('#user-id-display').textContent = user.id.slice(0, 12) + '...';

    // Get saved profile
    let profileData = store.get('profile');
    if (!profileData) {
      profileData = await getProfile();
    }

    // Populate form
    const name = profileData?.display_name || '';
    const avatarSeed = profileData?.avatar_seed || user.id || 'default';
    const theme = profileData?.theme || 'emerald';

    container.querySelector('#profile-name').value = name;
    container.querySelector('#profile-avatar-seed').value = avatarSeed;
    // Show initials in avatar circle
    updateAvatarDisplay(name);

    // Set active theme
    container.querySelectorAll('.theme-chip').forEach(btn => {
      if (btn.dataset.theme === theme) {
        btn.classList.add('bg-secondary-container', 'text-on-secondary-container', 'border-secondary');
        btn.classList.remove('bg-surface-container', 'text-on-surface-variant', 'border-outline-variant');
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.style.fontVariationSettings = "'FILL' 1";
      }
    });

    // Load stats
    loadStats(user.id, container);

    container.querySelector('#profile-loading').classList.add('hidden');
    container.querySelector('#profile-content').classList.remove('hidden');

  } catch (error) {
    container.querySelector('#profile-loading').classList.add('hidden');
    container.querySelector('#profile-error').classList.remove('hidden');
    container.querySelector('#profile-error-msg').textContent = error.message;
    container.querySelector('#retry-btn').addEventListener('click', () => {
      navigate('/profile');
    });
    return;
  }

  // --- Event handlers ---

  // Theme selection
  container.querySelectorAll('.theme-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.theme-chip').forEach(b => {
        b.classList.remove('bg-secondary-container', 'text-on-secondary-container', 'border-secondary');
        b.classList.add('bg-surface-container', 'text-on-surface-variant', 'border-outline-variant');
        const icon = b.querySelector('.material-symbols-outlined');
        if (icon) icon.style.fontVariationSettings = "'FILL' 0";
      });
      btn.classList.add('bg-secondary-container', 'text-on-secondary-container', 'border-secondary');
      btn.classList.remove('bg-surface-container', 'text-on-surface-variant', 'border-outline-variant');
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.style.fontVariationSettings = "'FILL' 1";
    });
  });

  // Avatar shuffle
  container.querySelector('#shuffle-avatar-btn').addEventListener('click', shuffleAvatar);

  function shuffleAvatar() {
    const seed = Math.random().toString(36).substring(2, 8);
    container.querySelector('#profile-avatar-seed').value = seed;
    // Rotate background color
    updateAvatarDisplay(container.querySelector('#profile-name').value.trim());
  }

  // Update avatar display
  function updateAvatarDisplay(name) {
    const avatar = container.querySelector('#profile-avatar');
    if (!avatar) return;
    const seed = container.querySelector('#profile-avatar-seed').value || 'default';
    const colors = ['bg-primary text-on-primary', 'bg-secondary text-on-secondary', 'bg-tertiary text-on-tertiary', 'bg-error text-on-error'];
    const colorIdx = Math.abs(hashCode(seed)) % colors.length;
    avatar.className = `w-full h-full flex items-center justify-center font-display-lg text-display-lg-mobile ${colors[colorIdx]}`;
    avatar.textContent = (name || '?').slice(0, 2).toUpperCase() || '?';
  }

  // Simple hash for deterministic color selection
  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash;
  }

  // Save profile
  container.querySelector('#save-profile-btn').addEventListener('click', async () => {
    const name = container.querySelector('#profile-name').value.trim();
    if (!name) {
      showToast('error', 'Please enter a display name.');
      return;
    }

    const avatarSeed = container.querySelector('#profile-avatar-seed').value;
    const theme = container.querySelector('.theme-chip.bg-secondary-container')?.dataset?.theme || 'emerald';
    const btn = container.querySelector('#save-profile-btn');

    btn.disabled = true;
    btn.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Saving...';

    try {
      await upsertProfile({ display_name: name, avatar_seed: avatarSeed, theme });
      store.set('profile', { ...store.get('profile'), display_name: name, avatar_seed: avatarSeed, theme });
      showToast('success', 'Profile saved!');
    } catch (error) {
      showToast('error', error.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-variation-settings:\'FILL\'1">save</span> Save Profile';
    }
  });

  // Sign out
  container.querySelector('#signout-btn').addEventListener('click', async () => {
    if (confirm('Sign out? Your profile will be saved for next time.')) {
      await supabase.auth.signOut();
      store.set('user', null);
      store.set('profile', null);
      showToast('info', 'Signed out successfully.');
      navigate('/');
      // Reload to get new anonymous session
      window.location.reload();
    }
  });
}

async function loadStats(userId, container) {
  try {
    // Count games
    const { count: gameCount, error: gameError } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', userId);

    if (!gameError && container) {
      container.querySelector('#stat-games').textContent = gameCount || 0;
    }

    // Count words
    const { count: wordCount, error: wordError } = await supabase
      .from('game_words')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', userId);

    if (!wordError && container) {
      container.querySelector('#stat-words').textContent = wordCount || 0;
    }

    // Total score
    const { data: totalScoreData } = await supabase
      .from('group_members')
      .select('score')
      .eq('player_id', userId);

    if (totalScoreData && totalScoreData.length > 0 && container) {
      const totalScore = totalScoreData.reduce((sum, m) => sum + (m.score || 0), 0);
      container.querySelector('#stat-score').textContent = totalScore;
    }
  } catch (e) {
    console.warn('Could not load stats:', e.message);
  }
}

// showToast imported from utils/ui.js
