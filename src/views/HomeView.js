import store from '../store.js';
import { signInWithProvider, getCurrentUser, getProfile, supabase } from '../supabase.js';
import { navigate } from '../router.js';
import { showToast, updateUserBadge } from '../utils/ui.js';

/**
 * HomeView - Landing screen with social login & group creation
 */
export default async function HomeView(container) {
  const user = store.get('user');
  const profile = store.get('profile');
  // Treat anonymous sessions as not-logged-in (defensive: anonymous auth may be enabled in Supabase)
  const isAnon = !!user?.is_anonymous;
  const isLoggedIn = !!(user && profile && !isAnon);

  container.innerHTML = `
    <div class="flex flex-col gap-6 pb-28 animate-fade-in-up">

      ${!isLoggedIn ? `
        <!-- Hero Section (not logged in) -->
        <div class="glass-card p-8 text-center relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none"></div>
          <div class="relative z-10">
            <div class="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-5">
              <span class="material-symbols-outlined text-3xl text-primary" style="font-variation-settings:'FILL'1">hub</span>
            </div>
            <h2 class="font-display text-display-md font-extrabold text-gradient mb-2">WordChain</h2>
            <p class="text-body-md text-dark-text-muted max-w-sm mx-auto mb-8">
              Learn English through play. Connect words, challenge friends, track your progress.
            </p>

            <!-- Social Login Buttons -->
            <div class="space-y-3 max-w-sm mx-auto">
              <button id="login-google" class="btn-google">
                <svg class="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.146 15.055 0 12 0 7.27 0 3.198 2.678 1.24 6.65l4.026 3.115Z"/>
                  <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
                  <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.566-5.09 3.566-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.649-1.12 2.946-2.397 3.558l3.795 2.987Z"/>
                  <path fill="#FBBC05" d="M5.266 14.765a7.08 7.08 0 0 1-.01-1.53L1.24 10.65A11.965 11.965 0 0 0 0 12c0 1.788.464 3.486 1.24 4.85l4.026-3.085Z"/>
                </svg>
                Continue with Google
              </button>
              <button id="login-facebook" class="btn-facebook">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Continue with Facebook
              </button>
              <button id="login-github" class="btn-github">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Continue with GitHub
              </button>
            </div>

            <p class="text-body-sm text-dark-text-muted mt-6">
              By continuing, you agree to our Terms of Service.
            </p>
          </div>
        </div>
      ` : `
        <!-- Welcome Back (logged in) -->
        <div class="glass-card p-6 flex items-center gap-4 animate-fade-in-up">
          <div class="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center overflow-hidden flex-shrink-0">
            ${profile?.avatar_url
              ? `<img src="${profile.avatar_url}" alt="" class="w-full h-full object-cover" />`
              : `<span class="material-symbols-outlined text-2xl text-primary" style="font-variation-settings:'FILL'1">person</span>`
            }
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="font-heading text-heading-sm text-dark-text truncate">Welcome back, ${profile?.display_name || 'Player'}!</h2>
            <p class="text-body-sm text-dark-text-muted mt-0.5">
              <span class="text-warning">${profile?.gems || 0} 💎</span>
              <span class="mx-2">·</span>
              ${profile?.total_days_active || 0} day streak
            </p>
          </div>
        </div>
      `}

      ${isLoggedIn ? `
        <!-- Create Game Section -->
        <div class="glass-card p-6 space-y-5 animate-fade-in-up animate-delay-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center">
              <span class="material-symbols-outlined text-xl text-secondary" style="font-variation-settings:'FILL'1">play_circle</span>
            </div>
            <div>
              <h3 class="font-heading text-heading-sm text-dark-text">Start a Game</h3>
              <p class="text-body-sm text-dark-text-muted">Create a group and invite friends</p>
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <label class="text-label-sm text-dark-text-muted mb-2 block">Group Name</label>
              <input id="group-name-input" type="text" maxlength="30" placeholder="Study Room"
                class="input-glass" />
            </div>
            <div>
              <label class="text-label-sm text-dark-text-muted mb-2 block">Game Mode</label>
              <div class="flex gap-2">
                <button class="mode-btn flex-1 px-3 py-2.5 rounded-xl bg-primary/15 text-primary border border-primary/20 font-heading text-body-sm font-semibold transition-all" data-mode="turns_timed">
                  <span class="material-symbols-outlined text-lg block mx-auto mb-1">timer</span>
                  Timed
                </button>
                <button class="mode-btn flex-1 px-3 py-2.5 rounded-xl bg-glass text-dark-text-muted border border-glass-border font-heading text-body-sm font-semibold transition-all hover:bg-glass-light" data-mode="turns_relaxed">
                  <span class="material-symbols-outlined text-lg block mx-auto mb-1">self_improvement</span>
                  Relaxed
                </button>
                <button class="mode-btn flex-1 px-3 py-2.5 rounded-xl bg-glass text-dark-text-muted border border-glass-border font-heading text-body-sm font-semibold transition-all hover:bg-glass-light" data-mode="free_for_all">
                  <span class="material-symbols-outlined text-lg block mx-auto mb-1">diversity_3</span>
                  Open
                </button>
              </div>
            </div>
            <button id="create-game-btn" class="w-full py-3.5 btn-primary text-body-md flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-lg">add</span>
              Create Game Room
            </button>
          </div>

          <!-- Created game link display -->
          <div id="created-game" class="hidden animate-fade-in">
            <div class="p-4 rounded-xl bg-secondary/10 border border-secondary/20">
              <p class="text-body-sm text-secondary font-semibold mb-2">Game Created! 🎉</p>
              <div class="flex items-center gap-2">
                <input id="invite-link-input" type="text" readonly
                  class="flex-1 px-3 py-2.5 rounded-lg bg-glass border border-glass-border text-body-sm text-dark-text font-mono outline-none" />
                <button id="copy-invite-btn" class="px-4 py-2.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-all">
                  <span class="material-symbols-outlined text-lg">content_copy</span>
                </button>
              </div>
              <button id="go-to-lobby-btn" class="w-full mt-3 py-2.5 rounded-xl btn-secondary text-body-sm">
                Go to Lobby
              </button>
            </div>
          </div>
        </div>

        <!-- Join Game Section -->
        <div class="glass-card p-6 space-y-4 animate-fade-in-up animate-delay-200">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
              <span class="material-symbols-outlined text-xl text-accent" style="font-variation-settings:'FILL'1">group_add</span>
            </div>
            <div>
              <h3 class="font-heading text-heading-sm text-dark-text">Join a Game</h3>
              <p class="text-body-sm text-dark-text-muted">Enter an invite code to join a friend's game</p>
            </div>
          </div>
          <div class="flex gap-2">
            <input id="join-code-input" type="text" maxlength="30" placeholder="Enter invite code..."
              class="input-glass flex-1 uppercase" />
            <button id="join-game-btn" class="px-6 py-3.5 rounded-xl btn-secondary text-body-sm whitespace-nowrap">
              Join
            </button>
          </div>
        </div>

        <!-- Solo Play -->
        <div class="glass-card-hover p-6 flex items-center gap-4 cursor-pointer animate-fade-in-up animate-delay-300" id="solo-play-btn">
          <div class="w-12 h-12 rounded-xl bg-warning-container flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl text-warning" style="font-variation-settings:'FILL'1">person</span>
          </div>
          <div class="flex-1">
            <h3 class="font-heading text-heading-sm text-dark-text">Practice Solo</h3>
            <p class="text-body-sm text-dark-text-muted">Play offline against the bot</p>
          </div>
          <span class="material-symbols-outlined text-dark-text-muted">chevron_right</span>
        </div>

        <!-- Active players count -->
        <div class="text-center animate-fade-in-up animate-delay-300">
          <p class="text-body-sm text-dark-text-muted">
            <span id="active-players-count" class="text-primary font-semibold">--</span> players active right now
          </p>
        </div>
      ` : ''}
    </div>
  `;

  if (!isLoggedIn) {
    // Social login handlers
    setupSocialLogin('login-google', 'google');
    setupSocialLogin('login-facebook', 'facebook');
    setupSocialLogin('login-github', 'github');
    return;
  }

  // --- Logged-in handlers ---

  // Game mode selection
  let selectedMode = 'turns_timed';
  container.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.remove('bg-primary/15', 'text-primary', 'border-primary/20');
        b.classList.add('bg-glass', 'text-dark-text-muted', 'border-glass-border');
      });
      btn.classList.add('bg-primary/15', 'text-primary', 'border-primary/20');
      btn.classList.remove('bg-glass', 'text-dark-text-muted', 'border-glass-border');
      selectedMode = btn.dataset.mode;
    });
  });

  // Create game
  container.querySelector('#create-game-btn').addEventListener('click', async () => {
    const nameInput = container.querySelector('#group-name-input');
    const name = nameInput.value.trim() || 'Study Room';
    const btn = container.querySelector('#create-game-btn');
    const createdDiv = container.querySelector('#created-game');

    btn.disabled = true;
    btn.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Creating...';

    try {
      const { createGroup } = await import('../supabase.js');
      const group = await createGroup(name, selectedMode, {});
      const inviteLink = `${window.location.origin}/wordchain/#/join/${group.code}`;

      createdDiv.classList.remove('hidden');
      container.querySelector('#invite-link-input').value = inviteLink;

      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-lg">add</span> Create Game Room`;

      // Copy link
      container.querySelector('#copy-invite-btn').onclick = () => {
        navigator.clipboard.writeText(inviteLink);
        const copyBtn = container.querySelector('#copy-invite-btn');
        copyBtn.innerHTML = '<span class="material-symbols-outlined text-lg">check</span>';
        setTimeout(() => {
          copyBtn.innerHTML = '<span class="material-symbols-outlined text-lg">content_copy</span>';
        }, 2000);
        showToast('success', 'Invite link copied!');
      };

      // Go to lobby
      container.querySelector('#go-to-lobby-btn').onclick = () => {
        navigate(`/lobby/${group.id}`);
      };

      // Auto-navigate to lobby
      navigate(`/lobby/${group.id}`);
    } catch (error) {
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-lg">add</span> Create Game Room`;
      showToast('error', error.message);
    }
  });

  // Join game
  container.querySelector('#join-game-btn').addEventListener('click', async () => {
    const codeInput = container.querySelector('#join-code-input');
    const code = codeInput.value.trim();
    if (!code) {
      showToast('error', 'Please enter an invite code.');
      return;
    }

    try {
      const { getGroupByCode } = await import('../supabase.js');
      const group = await getGroupByCode(code);
      if (!group) {
        showToast('error', 'Group not found. Check the code.');
        return;
      }
      navigate(`/join/${code}`);
    } catch (error) {
      showToast('error', error.message);
    }
  });

  // Solo play
  container.querySelector('#solo-play-btn').addEventListener('click', () => {
    navigate('/play/solo');
  });

  // Load active player count
  loadActivePlayerCount();
}

function setupSocialLogin(elementId, provider) {
  const btn = document.getElementById(elementId);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.innerHTML = '<div class="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div> Signing in...';
    try {
      await signInWithProvider(provider);
    } catch (error) {
      showToast('error', error.message);
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
    }
  });
  // Store original HTML
  btn.dataset.originalHtml = btn.innerHTML;
}

async function loadActivePlayerCount() {
  try {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('total_score', 1);
    const el = document.getElementById('active-players-count');
    if (el) el.textContent = count || 0;
  } catch (e) {
    const el = document.getElementById('active-players-count');
    if (el) el.textContent = '0';
  }
}
