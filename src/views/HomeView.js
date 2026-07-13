import store from '../store.js';
import { navigate } from '../router.js';
import { supabase, ensureAuth, getProfile, upsertProfile } from '../supabase.js';
import { generateGroupName } from '../utils/words.js';
import { openDictionary } from '../components/DictionaryModal.js';
import { showToast } from '../utils/ui.js';

/**
 * Home / Main Menu view
 * Shows: active players count, create/join group, how to play
 */
export default async function HomeView(container, params) {
  console.log('[WordChain] HomeView rendering...');
  store.set('currentView', '/');

  try {
    container.innerHTML = `
    <!-- Hero Section -->
    <section class="grid grid-cols-1 md:grid-cols-3 gap-gap-md mb-gap-lg">
      <div class="md:col-span-2 relative overflow-hidden rounded-2xl p-gap-lg bg-primary-container text-on-primary-container min-h-[220px] flex flex-col justify-end">
        <div class="floating-blob bg-white/10 w-48 h-48 -top-10 -right-10"></div>
        <div class="relative z-10">
          <div class="flex items-center gap-2 mb-2">
            <span class="px-3 py-1 bg-white/20 text-white text-xs font-bold uppercase rounded-full">Multiplayer</span>
            <span class="px-3 py-1 bg-secondary-container/30 text-white text-xs font-bold uppercase rounded-full">Word Game</span>
          </div>
          <h2 class="font-headline-md text-headline-md mb-2">WordChain Lobby</h2>
          <p class="font-body-lg text-body-lg opacity-90 max-w-md">Connect words, challenge friends, and master the vocabulary chain in real-time.</p>
        </div>
      </div>
      <div class="rounded-2xl p-gap-md bg-surface-container-high border border-outline-variant flex flex-col justify-center items-center text-center">
        <span class="material-symbols-outlined text-primary text-5xl mb-2" style="font-variation-settings:'FILL'1">groups</span>
        <p class="font-headline-sm text-headline-sm" id="active-players-count">—</p>
        <p class="font-label-caps text-label-caps text-outline uppercase">Active Players</p>
      </div>
    </section>

    <!-- Main Actions -->
    <section class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg shadow-sm mb-gap-lg">
      <div class="space-y-gap-lg text-center py-6" id="create-action-container">
        <div id="home-initial">
          <h3 class="font-headline-md text-headline-md mb-gap-sm">Ready to play?</h3>
          <p class="font-body-md text-body-md text-on-surface-variant mb-gap-lg">Create a private room and invite your friends to a word battle.</p>
          <div class="flex flex-col sm:flex-row gap-gap-md justify-center">
            <button id="create-group-btn" class="px-8 py-4 bg-primary text-on-primary font-headline-sm text-headline-sm rounded-xl btn-shadow transition-all flex items-center justify-center gap-md">
              <span class="material-symbols-outlined" style="font-variation-settings:'FILL'1">add_circle</span>
              Create Group
            </button>
            <div class="flex items-center gap-3">
              <span class="text-outline font-label-caps text-label-caps uppercase">or</span>
              <button id="join-group-btn" class="px-8 py-4 bg-surface-container-high text-primary font-headline-sm text-headline-sm rounded-xl border-2 border-primary/30 hover:border-primary transition-all flex items-center justify-center gap-md">
                <span class="material-symbols-outlined">login</span>
                Join Game
              </button>
            </div>
          </div>
        </div>
        <div id="home-join-form" class="hidden animate-slide-up">
          <h3 class="font-headline-md text-headline-md mb-gap-sm">Join a Game</h3>
          <p class="font-body-md text-body-md text-on-surface-variant mb-gap-lg">Enter the invite code from your friend.</p>
          <div class="flex flex-col sm:flex-row items-center gap-gap-md max-w-md mx-auto">
            <input id="join-code-input" type="text" placeholder="e.g. vibrant-tiger-42" 
              class="w-full px-gap-md py-4 bg-surface-container-high border-2 border-outline-variant focus:border-primary focus:ring-0 rounded-xl font-body-md text-body-md outline-none transition-all text-center uppercase" 
              maxlength="50" />
            <button id="join-submit-btn" class="w-full sm:w-auto px-gap-lg py-4 bg-primary text-on-primary font-headline-sm text-headline-sm rounded-xl btn-shadow transition-all flex items-center justify-center gap-sm whitespace-nowrap">
              <span class="material-symbols-outlined">arrow_forward</span>
              Join
            </button>
          </div>
          <button id="join-back-btn" class="mt-4 text-sm text-outline hover:text-primary transition-colors">← Back</button>
        </div>
      </div>
    </section>

    <!-- Create Group Progress (Hidden initially) -->
    <div id="create-progress" class="hidden mb-gap-lg bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg">
      <div class="flex items-center gap-4">
        <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div>
          <p class="font-headline-sm text-headline-sm">Creating your group...</p>
          <p class="font-body-md text-body-md text-on-surface-variant">Setting up the game room.</p>
        </div>
      </div>
    </div>

    <!-- Group Created State (Hidden initially) -->
    <div id="group-created" class="hidden mb-gap-lg bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg animate-slide-up">
      <div class="text-center py-6">
        <div class="bg-secondary-container text-on-secondary-container px-gap-md py-gap-sm rounded-full inline-flex items-center gap-sm mb-gap-md">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings:'FILL'1">check_circle</span>
          <span class="font-label-caps text-label-caps">GROUP CREATED</span>
        </div>
        <h3 class="font-headline-md text-headline-md mb-gap-sm">Invite your friends</h3>
        <p class="font-body-md text-body-md text-on-surface-variant mb-gap-lg">Share this link or code to let others join your lobby.</p>
        <div class="flex flex-col items-center gap-gap-md max-w-md mx-auto">
          <div id="group-code-display" class="w-full bg-surface-container-high px-gap-md py-4 rounded-xl border-2 border-primary/30 font-mono text-primary font-bold text-lg text-center tracking-wider">
            loading...
          </div>
          <div class="flex gap-gap-md w-full">
            <button id="copy-link-btn" class="flex-1 px-gap-lg py-4 bg-primary-container text-on-primary-container font-label-caps text-label-caps rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-sm">
              <span class="material-symbols-outlined">content_copy</span>
              Copy Link
            </button>
            <button id="go-to-lobby-btn" class="flex-1 px-gap-lg py-4 bg-primary text-on-primary font-label-caps text-label-caps rounded-xl btn-shadow transition-all flex items-center justify-center gap-sm">
              <span class="material-symbols-outlined">arrow_forward</span>
              Go to Lobby
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- How to Play -->
    <section class="grid grid-cols-1 md:grid-cols-2 gap-gap-md items-stretch mb-gap-lg">
      <div class="bg-surface-container rounded-2xl p-gap-lg flex flex-col justify-between">
        <div>
          <h3 class="font-headline-sm text-headline-sm flex items-center gap-sm mb-gap-md">
            <span class="material-symbols-outlined text-tertiary">lightbulb</span>
            How to Play
          </h3>
          <div class="space-y-gap-md">
            <div class="flex gap-md">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center font-bold text-sm">1</div>
              <p class="font-body-md text-body-md">The first player submits any valid word (e.g., <span class="font-bold text-primary">APPLE</span>).</p>
            </div>
            <div class="flex gap-md">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center font-bold text-sm">2</div>
              <p class="font-body-md text-body-md">The next player must start their word with the <span class="font-bold text-error">final letter</span> of the previous word.</p>
            </div>
            <div class="flex gap-md">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center font-bold text-sm">3</div>
              <p class="font-body-md text-body-md">Example: Apple → <span class="font-bold text-primary">E</span>lephant → <span class="font-bold text-primary">T</span>rain.</p>
            </div>
          </div>
        </div>
        <div class="mt-gap-lg pt-gap-md border-t border-outline-variant/30 italic text-on-surface-variant font-body-md">
          Rule: No word can be repeated in the same game!
        </div>
      </div>
      <div class="relative min-h-[200px] rounded-2xl overflow-hidden bg-gradient-to-br from-primary-container/20 to-secondary-container/20 flex items-center justify-center p-6">
        <div class="text-center">
          <span class="material-symbols-outlined text-6xl text-primary mb-2" style="font-variation-settings:'FILL'1">stadia_controller</span>
          <p class="font-headline-sm text-headline-sm text-primary">Build the longest chain!</p>
          <p class="font-body-md text-body-md text-on-surface-variant mt-1">The longer the word, the higher the score.</p>
        </div>
      </div>
    </section>

    <!-- Solo Play CTA -->
    <section class="bg-gradient-to-r from-secondary-container/20 to-primary-container/20 rounded-2xl p-gap-lg border border-secondary/20 mb-gap-lg">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-gap-md">
        <div>
          <h3 class="font-headline-sm text-headline-sm flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary">person</span>
            Practice Solo
          </h3>
          <p class="font-body-md text-body-md text-on-surface-variant">Play against a bot opponent, even offline.</p>
        </div>
        <button id="solo-play-btn" class="px-6 py-3 bg-secondary text-on-secondary font-headline-sm text-headline-sm rounded-xl btn-tactile transition-all flex items-center gap-2 whitespace-nowrap">
          <span class="material-symbols-outlined">play_arrow</span>
          Play Solo
        </button>
      </div>
    </section>

    <!-- Spacer for bottom nav -->
    <div class="h-24"></div>
  `;

  // --- Event Handlers ---

  // Create Group
  container.querySelector('#create-group-btn').addEventListener('click', async () => {
    const initial = container.querySelector('#home-initial');
    const progress = container.querySelector('#create-progress');
    const created = container.querySelector('#group-created');
    const codeDisplay = container.querySelector('#group-code-display');

    initial.classList.add('hidden');
    progress.classList.remove('hidden');

    try {
      const user = await ensureAuth();
      if (!user) throw new Error('Could not authenticate. Please try again.');

      // Ensure a profile exists before creating the group (host_id references profiles)
      const existingProfile = store.get('profile');
      if (!existingProfile) {
        await upsertProfile({
          display_name: `Player-${user.id.slice(0, 4)}`,
          avatar_seed: user.id,
        });
      }

      const name = generateGroupName();
      const { data, error } = await supabase
        .from('groups')
        .insert({
          code: `${generateGroupName().toLowerCase().replace(/\s+/g, '-')}-${Math.floor(Math.random() * 99) + 1}`,
          name: name,
          host_id: user.id,
          status: 'waiting',
        })
        .select()
        .single();

      if (error) throw error;

      // Update store with profile info
      const profile = await getProfile();
      if (profile) store.set('profile', profile);

      progress.classList.add('hidden');
      created.classList.remove('hidden');

      const fullLink = `${window.location.origin}/wordchain/#/join/${data.code}`;
      codeDisplay.textContent = data.code;

      container.querySelector('#copy-link-btn').onclick = () => {
        navigator.clipboard.writeText(fullLink).then(() => {
          const btn = container.querySelector('#copy-link-btn');
          btn.innerHTML = '<span class="material-symbols-outlined">check</span> Copied!';
          setTimeout(() => {
            btn.innerHTML = '<span class="material-symbols-outlined">content_copy</span> Copy Link';
          }, 2000);
        });
      };

      container.querySelector('#go-to-lobby-btn').onclick = () => {
        navigate(`/lobby/${data.id}`);
      };

      store.set('currentGroup', data);
    } catch (error) {
      progress.classList.add('hidden');
      initial.classList.remove('hidden');
      showToast('error', 'Failed to create group: ' + error.message);
    }
  });

  // Join Game - Show form
  container.querySelector('#join-group-btn').addEventListener('click', () => {
    container.querySelector('#home-initial').classList.add('hidden');
    container.querySelector('#home-join-form').classList.remove('hidden');
  });

  // Join Game - Submit
  container.querySelector('#join-submit-btn').addEventListener('click', async () => {
    const code = container.querySelector('#join-code-input').value.trim().toLowerCase();
    if (!code) {
      showToast('error', 'Please enter a group code.');
      return;
    }

    const profile = store.get('profile');
    if (profile) {
      navigate(`/join/${code}`);
    } else {
      navigate(`/join/${code}`);
    }
  });

  container.querySelector('#join-code-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      container.querySelector('#join-submit-btn').click();
    }
  });

  container.querySelector('#join-back-btn').addEventListener('click', () => {
    container.querySelector('#home-join-form').classList.add('hidden');
    container.querySelector('#home-initial').classList.remove('hidden');
  });

  // Solo Play
  container.querySelector('#solo-play-btn').addEventListener('click', () => {
    navigate('/play/solo');
  });

  // Update connection status
  updateConnectionStatus();

  // Load active player count
  loadActivePlayerCount();

  console.log('[WordChain] HomeView rendered successfully');
  } catch (e) {
    console.error('[WordChain] HomeView render error:', e);
  }
}

async function loadActivePlayerCount() {
  try {
    const { supabase } = await import('../supabase.js');
    const { count } = await supabase
      .from('groups')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    const countEl = document.getElementById('active-players-count');
    if (countEl) countEl.textContent = count || 0;
  } catch (e) {
    // Silently fail - stat is cosmetic
  }
}

function updateConnectionStatus() {
  const dot = document.getElementById('connection-status');
  if (navigator.onLine) {
    dot.classList.remove('hidden');
    dot.classList.add('bg-secondary');
  } else {
    dot.classList.add('hidden');
  }
}

// showToast imported from utils/ui.js
