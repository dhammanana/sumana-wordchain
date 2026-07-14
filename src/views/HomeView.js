/**
 * HomeView - Main menu / study room creator
 *
 * Design note: This app is designed for monks and Buddhist practitioners.
 * Terminology focuses on "study", "practice", "learning" rather than "game".
 * Avatars use clean initials style with custom seeds for personalization.
 * The UI is calm, mindful - designed for vocabulary study sessions.
 */
import store from '../store.js';
import { navigate } from '../router.js';
import { supabase, ensureAuth, getProfile, upsertProfile, createGroup } from '../supabase.js';
import { generateGroupName } from '../utils/words.js';
import { showToast } from '../utils/ui.js';

export default async function HomeView(container, params) {
  store.set('currentView', '/');

  try {
    // Track the selected game mode
    let selectedMode = 'turns_timed';

    container.innerHTML = `
    <!-- Hero Section - Study Focused -->
    <section class="grid grid-cols-1 md:grid-cols-3 gap-gap-md mb-gap-lg">
      <div class="md:col-span-2 relative overflow-hidden rounded-2xl p-gap-lg bg-gradient-to-br from-primary-container/80 to-secondary-container/40 min-h-[220px] flex flex-col justify-end">
        <div class="floating-blob bg-white/10 w-48 h-48 -top-10 -right-10"></div>
        <div class="relative z-10">
          <div class="flex items-center gap-2 mb-2">
            <span class="px-3 py-1 bg-white/20 text-white text-xs font-bold uppercase rounded-full">Study Group</span>
            <span class="px-3 py-1 bg-secondary-container/30 text-white text-xs font-bold uppercase rounded-full">Vocabulary</span>
          </div>
          <h2 class="font-headline-md text-headline-md mb-2">WordChain Study</h2>
          <p class="font-body-lg text-body-lg opacity-90 max-w-md">Build vocabulary together. Connect words mindfully, learn from each other in a calm study environment.</p>
        </div>
      </div>
      <div class="rounded-2xl p-gap-md bg-surface-container-high border border-outline-variant flex flex-col justify-center items-center text-center">
        <span class="material-symbols-outlined text-primary text-5xl mb-2" style="font-variation-settings:'FILL'1">groups</span>
        <p class="font-headline-sm text-headline-sm" id="active-players-count">—</p>
        <p class="font-label-caps text-label-caps text-outline uppercase">Active Learners</p>
      </div>
    </section>

    <!-- Main Actions - Study focused -->
    <section class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg shadow-sm mb-gap-lg">
      <div class="space-y-gap-lg text-center py-6" id="create-action-container">
        <div id="home-initial">
          <h3 class="font-headline-md text-headline-md mb-gap-sm">Begin a Study Session</h3>
          <p class="font-body-md text-body-md text-on-surface-variant mb-gap-lg">Create a quiet study room and invite friends to practice English vocabulary together.</p>
          <div class="flex flex-col sm:flex-row gap-gap-md justify-center">
            <button id="create-group-btn" class="px-8 py-4 bg-primary text-on-primary font-headline-sm text-headline-sm rounded-xl btn-shadow transition-all flex items-center justify-center gap-md">
              <span class="material-symbols-outlined" style="font-variation-settings:'FILL'1">add_circle</span>
              Create Study Group
            </button>
            <div class="flex items-center gap-3">
              <span class="text-outline font-label-caps text-label-caps uppercase">or</span>
              <button id="join-group-btn" class="px-8 py-4 bg-surface-container-high text-primary font-headline-sm text-headline-sm rounded-xl border-2 border-primary/30 hover:border-primary transition-all flex items-center justify-center gap-md">
                <span class="material-symbols-outlined">login</span>
                Join Study
              </button>
            </div>
          </div>
        </div>
        <div id="home-join-form" class="hidden animate-slide-up">
          <h3 class="font-headline-md text-headline-md mb-gap-sm">Join a Study Session</h3>
          <p class="font-body-md text-body-md text-on-surface-variant mb-gap-lg">Enter the invite code shared by your study partner.</p>
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

        <!-- Game Mode Selector (shown after clicking Create) -->
        <div id="mode-selector" class="hidden animate-slide-up border-t border-outline-variant/20 pt-gap-lg mt-gap-lg">
          <h3 class="font-headline-sm text-headline-sm mb-gap-md">Choose Study Mode</h3>
          <p class="font-body-md text-body-md text-on-surface-variant mb-gap-md">Select how you'd like to practice together:</p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-gap-md">
            <button class="mode-option bg-surface-container rounded-xl p-gap-md border-2 border-primary text-left hover:bg-surface-container-high transition-all cursor-pointer" data-mode="turns_timed">
              <span class="material-symbols-outlined text-primary text-2xl mb-1" style="font-variation-settings:'FILL'1">timer</span>
              <p class="font-headline-sm text-headline-sm">Guided Turns</p>
              <p class="font-label-caps text-label-caps text-outline mt-1">Take turns with a gentle timer. Practice mindful word recall with a soft time guide.</p>
            </button>
            <button class="mode-option bg-surface-container rounded-xl p-gap-md border-2 border-outline-variant text-left hover:bg-surface-container-high transition-all cursor-pointer" data-mode="turns_relaxed">
              <span class="material-symbols-outlined text-tertiary text-2xl mb-1" style="font-variation-settings:'FILL'1">self_improvement</span>
              <p class="font-headline-sm text-headline-sm">Relaxed Turns</p>
              <p class="font-label-caps text-label-caps text-outline mt-1">Take turns with no time pressure. A session can last for days — study at your own pace.</p>
            </button>
            <button class="mode-option bg-surface-container rounded-xl p-gap-md border-2 border-outline-variant text-left hover:bg-surface-container-high transition-all cursor-pointer" data-mode="free_for_all">
              <span class="material-symbols-outlined text-secondary text-2xl mb-1" style="font-variation-settings:'FILL'1">diversity_3</span>
              <p class="font-headline-sm text-headline-sm">Open Practice</p>
              <p class="font-label-caps text-label-caps text-outline mt-1">Anyone can add words at any time. Perfect for a shared long-running vocabulary board.</p>
            </button>
          </div>
          <button id="create-with-mode-btn" class="mt-gap-md w-full py-4 bg-primary text-on-primary font-headline-sm text-headline-sm rounded-xl btn-shadow transition-all flex items-center justify-center gap-md">
            <span class="material-symbols-outlined" style="font-variation-settings:'FILL'1">add_circle</span>
            Create Study Group
          </button>
        </div>
      </div>
    </section>

    <!-- Create Group Progress (Hidden initially) -->
    <div id="create-progress" class="hidden mb-gap-lg bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg">
      <div class="flex items-center gap-4">
        <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div>
          <p class="font-headline-sm text-headline-sm">Creating your study room...</p>
          <p class="font-body-md text-body-md text-on-surface-variant">Setting up the shared space.</p>
        </div>
      </div>
    </div>

    <!-- Group Created State (Hidden initially) -->
    <div id="group-created" class="hidden mb-gap-lg bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg animate-slide-up">
      <div class="text-center py-6">
        <div class="bg-secondary-container text-on-secondary-container px-gap-md py-gap-sm rounded-full inline-flex items-center gap-sm mb-gap-md">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings:'FILL'1">check_circle</span>
          <span class="font-label-caps text-label-caps">STUDY ROOM READY</span>
        </div>
        <h3 class="font-headline-md text-headline-md mb-gap-sm">Invite your friends</h3>
        <p class="font-body-md text-body-md text-on-surface-variant mb-gap-lg">Share this link or code to let others join your study session.</p>
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
              Go to Study Room
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- How to Study -->
    <section class="grid grid-cols-1 md:grid-cols-2 gap-gap-md items-stretch mb-gap-lg">
      <div class="bg-surface-container rounded-2xl p-gap-lg flex flex-col justify-between">
        <div>
          <h3 class="font-headline-sm text-headline-sm flex items-center gap-sm mb-gap-md">
            <span class="material-symbols-outlined text-tertiary">lightbulb</span>
            How to Study
          </h3>
          <div class="space-y-gap-md">
            <div class="flex gap-md">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center font-bold text-sm">1</div>
              <p class="font-body-md text-body-md">The first student submits any valid English word (e.g., <span class="font-bold text-primary">APPLE</span>).</p>
            </div>
            <div class="flex gap-md">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center font-bold text-sm">2</div>
              <p class="font-body-md text-body-md">The next word must start with the <span class="font-bold text-error">final letter</span> of the previous word.</p>
            </div>
            <div class="flex gap-md">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center font-bold text-sm">3</div>
              <p class="font-body-md text-body-md">Example: Apple → <span class="font-bold text-primary">E</span>lephant → <span class="font-bold text-primary">T</span>rain. Look up new words in the dictionary!</p>
            </div>
          </div>
        </div>
        <div class="mt-gap-lg pt-gap-md border-t border-outline-variant/30 italic text-on-surface-variant font-body-md">
          Note: Words cannot be repeated in the same session. Use the dictionary to learn new words!
        </div>
      </div>
      <div class="relative min-h-[200px] rounded-2xl overflow-hidden bg-gradient-to-br from-primary-container/10 to-secondary-container/10 flex items-center justify-center p-6">
        <div class="text-center">
          <span class="material-symbols-outlined text-6xl text-primary mb-2" style="font-variation-settings:'FILL'1">auto_stories</span>
          <p class="font-headline-sm text-headline-sm text-primary">Build your vocabulary!</p>
          <p class="font-body-md text-body-md text-on-surface-variant mt-1">The longer the word, the more you learn.</p>
        </div>
      </div>
    </section>

    <!-- Solo Study CTA -->
    <section class="bg-gradient-to-r from-tertiary-container/10 to-primary-container/10 rounded-2xl p-gap-lg border border-tertiary/10 mb-gap-lg">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-gap-md">
        <div>
          <h3 class="font-headline-sm text-headline-sm flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary">person</span>
            Study Alone
          </h3>
          <p class="font-body-md text-body-md text-on-surface-variant">Practice with a word bot companion. No pressure, learn at your own pace.</p>
        </div>
        <button id="solo-play-btn" class="px-6 py-3 bg-secondary text-on-secondary font-headline-sm text-headline-sm rounded-xl btn-tactile transition-all flex items-center gap-2 whitespace-nowrap">
          <span class="material-symbols-outlined">play_arrow</span>
          Start Practice
        </button>
      </div>
    </section>

    <!-- Spacer for bottom nav -->
    <div class="h-24"></div>
  `;

  // --- Event Handlers ---

  // "Create Study Group" button -> show mode selector
  container.querySelector('#create-group-btn').addEventListener('click', () => {
    container.querySelector('#home-initial').classList.add('hidden');
    container.querySelector('#mode-selector').classList.remove('hidden');
  });

  // Mode selection
  container.querySelectorAll('.mode-option').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.mode-option').forEach(b => {
        b.classList.remove('border-primary', 'bg-primary-container/10');
        b.classList.add('border-outline-variant');
      });
      btn.classList.remove('border-outline-variant');
      btn.classList.add('border-primary', 'bg-primary-container/10');
      selectedMode = btn.dataset.mode;
      container.querySelector('#create-with-mode-btn').classList.remove('hidden');
    });
  });

  // Create study group with selected mode
  container.querySelector('#create-with-mode-btn').addEventListener('click', async () => {
    const progress = container.querySelector('#create-progress');
    const modeSelector = container.querySelector('#mode-selector');
    const created = container.querySelector('#group-created');
    const codeDisplay = container.querySelector('#group-code-display');

    modeSelector.classList.add('hidden');
    progress.classList.remove('hidden');

    try {
      const user = await ensureAuth();
      if (!user) throw new Error('Could not authenticate. Please try again.');

      // Ensure a profile exists
      const existingProfile = store.get('profile');
      if (!existingProfile) {
        await upsertProfile({
          display_name: `Student-${user.id.slice(0, 4)}`,
          avatar_seed: user.id,
        });
      }

      const name = generateGroupName();
      // Use the createGroup function from supabase.js which also adds host as group_member
      const data = await createGroup(name, selectedMode);

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
      modeSelector.classList.remove('hidden');
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
    navigate(`/join/${code}`);
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

  // Solo Study
  container.querySelector('#solo-play-btn').addEventListener('click', () => {
    navigate('/play/solo');
  });

  // Load active player count
  loadActivePlayerCount();
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
  } catch (e) {}
}
