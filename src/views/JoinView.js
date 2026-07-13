import { supabase, getGroupByCode, ensureAuth } from '../supabase.js';
import { navigate } from '../router.js';
import store from '../store.js';
import { showToast } from '../utils/ui.js';

/**
 * Join view - Profile setup + Join group
 * This view is shown when a user opens a join link (#/join/:code)
 */
export default async function JoinView(container, params) {
  const { code } = params;
  store.set('currentView', '/join');

  // Look up the group
  let group;
  try {
    group = await getGroupByCode(code);
  } catch (e) {
    // Group might not exist yet or DB error
  }

  container.innerHTML = `
    <div class="flex flex-col items-center py-4">
      <!-- Decorative elements -->
      <div class="floating-blob bg-primary w-48 h-48 -top-10 -left-10"></div>
      <div class="floating-blob bg-secondary w-56 h-56 -bottom-10 -right-10"></div>

      <!-- Welcome Section -->
      <div class="text-center mb-gap-lg">
        <h2 class="font-display-lg text-display-lg-mobile text-on-background mb-gap-xs">Join the Chain</h2>
        <p class="font-body-md text-body-md text-on-surface-variant">${group ? `Joining "${group.name}"` : 'Set up your player profile to join the game.'}</p>
      </div>

      <!-- Profile Card -->
      <div class="w-full bg-surface-container-lowest border border-outline-variant p-gap-lg rounded-2xl shadow-sm flex flex-col items-center gap-lg">
        <!-- Avatar Selector -->
        <div class="relative group">
          <div class="w-32 h-32 md:w-36 md:h-36 rounded-full border-4 border-surface-container-high overflow-hidden bg-surface-container relative">
            <img id="avatar-preview" class="w-full h-full object-cover"
              src="https://api.dicebear.com/8.x/adventurer/svg?seed=${Math.random().toString(36).substring(2, 8)}"
              alt="Avatar" />
            <label class="absolute inset-0 bg-on-background/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full" for="avatar-seed-input">
              <span class="material-symbols-outlined text-surface-container-lowest text-3xl">refresh</span>
              <span class="font-label-caps text-label-caps text-surface-container-lowest mt-1">SHUFFLE</span>
            </label>
          </div>
        </div>
        <input type="hidden" id="avatar-seed" value="${Math.random().toString(36).substring(2, 8)}" />
        <button id="shuffle-avatar-btn" class="text-sm text-primary font-label-caps text-label-caps hover:underline flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">shuffle</span>
          Randomize Avatar
        </button>

        <!-- Profile Form -->
        <div class="w-full space-y-gap-md">
          <div class="flex flex-col gap-xs">
            <label class="font-label-caps text-label-caps text-on-surface-variant ml-1" for="player-name">YOUR NAME</label>
            <input id="player-name" type="text" maxlength="20" placeholder="Enter your nickname..."
              class="w-full px-gap-md py-4 rounded-xl border-2 border-outline-variant bg-surface-container-low font-input-text text-input-text focus:border-primary focus:ring-0 transition-all outline-none" />
          </div>

          <!-- Theme Chips -->
          <div class="flex flex-col gap-xs">
            <p class="font-label-caps text-label-caps text-on-surface-variant ml-1">PICK A THEME</p>
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
            </div>
          </div>
        </div>
      </div>

      <!-- Group Info -->
      <div id="group-info" class="w-full mt-gap-md p-gap-md bg-tertiary-container/10 border border-tertiary/20 rounded-xl flex items-start gap-md">
        <span class="material-symbols-outlined text-tertiary mt-1">info</span>
        <div>
          <p class="font-headline-sm text-headline-sm text-tertiary">
            ${group ? `Joining "${group.name}"` : 'Setting up profile...'}
          </p>
          <p class="font-body-md text-body-md text-on-surface-variant mt-1">
            ${group ? `Group code: ${group.code}` : 'Create a profile to start playing.'}
          </p>
        </div>
      </div>

      <!-- Join Button -->
      <div class="w-full mt-gap-lg pb-32">
        <button id="join-game-btn" class="w-full py-5 bg-primary text-on-primary font-headline-md text-headline-md rounded-xl btn-shadow transition-all flex items-center justify-center gap-md">
          Join Game
          <span class="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </div>
  `;

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
  container.querySelector('#avatar-preview').closest('.group')?.querySelector('label')?.addEventListener('click', shuffleAvatar);

  function shuffleAvatar() {
    const seed = Math.random().toString(36).substring(2, 8);
    container.querySelector('#avatar-seed').value = seed;
    container.querySelector('#avatar-preview').src = `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}`;
  }

  // Join game button
  container.querySelector('#join-game-btn').addEventListener('click', async () => {
    const name = container.querySelector('#player-name').value.trim();
    if (!name) {
      showToast('error', 'Please enter a name to continue.');
      return;
    }

    const avatarSeed = container.querySelector('#avatar-seed').value;
    const theme = container.querySelector('.theme-chip.bg-secondary-container')?.dataset?.theme || 'emerald';
    const btn = container.querySelector('#join-game-btn');

    btn.disabled = true;
    btn.innerHTML = '<div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Joining...';

    try {
      const user = await ensureAuth();
      if (!user) throw new Error('Could not authenticate. Please try again.');

      // Upsert profile
      if (!group) {
        // Just save profile, navigate to lobby later
        const { upsertProfile } = await import('../supabase.js');
        await upsertProfile({ display_name: name, avatar_seed: avatarSeed, theme });
        store.set('profile', { id: user.id, display_name: name, avatar_seed: avatarSeed, theme });
        showToast('success', 'Profile created! Now join or create a game.');
        navigate('/');
        return;
      }

      // Join the group
      const { joinGroup } = await import('../supabase.js');
      await joinGroup(code, name, avatarSeed);

      store.set('profile', { id: user.id, display_name: name, avatar_seed: avatarSeed, theme });
      store.set('currentGroup', group);

      showToast('success', `Joined "${group.name}" successfully!`);
      navigate(`/lobby/${group.id}`);
    } catch (error) {
      btn.disabled = false;
      btn.innerHTML = `Join Game <span class="material-symbols-outlined">arrow_forward</span>`;
      showToast('error', error.message);
    }
  });
}

// showToast imported from utils/ui.js
