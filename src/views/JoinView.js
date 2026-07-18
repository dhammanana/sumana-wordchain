import store from '../store.js';
import { supabase, getGroupByCode, getCurrentUser } from '../supabase.js';
import { navigate } from '../router.js';
import { showToast } from '../utils/ui.js';

/**
 * JoinView - Join a game group via invite code
 * Shows after login to complete profile setup
 */
export default async function JoinView(container, params) {
  const { code } = params;
  const user = store.get('user');
  const profile = store.get('profile');

  let group;
  try {
    group = await getGroupByCode(code);
  } catch (e) {}

  container.innerHTML = `
    <div class="flex flex-col items-center py-4 animate-fade-in-up">
      <div class="glass-card p-6 w-full mb-6">
        <div class="text-center mb-6">
          <div class="w-16 h-16 rounded-2xl bg-secondary/15 flex items-center justify-center mx-auto mb-4">
            <span class="material-symbols-outlined text-3xl text-secondary" style="font-variation-settings:'FILL'1">group_add</span>
          </div>
          <h2 class="font-heading text-heading-md text-dark-text mb-1">Join Study Session</h2>
          <p class="text-body-md text-dark-text-muted">${group ? `Joining "${group.name}"` : 'Enter the invite code to join a game.'}</p>
        </div>

        ${!user ? `
          <!-- Not logged in -->
          <div class="p-4 rounded-xl bg-warning-container border border-warning/20 text-center">
            <p class="text-body-sm text-warning font-semibold mb-3">You need to sign in first</p>
            <a href="#/" class="inline-block px-6 py-2.5 btn-primary text-body-sm">Go to Home & Sign In</a>
          </div>
        ` : `
          <!-- Profile Info -->
          <div class="glass p-4 rounded-xl flex items-center gap-3 mb-4">
            <div class="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center overflow-hidden flex-shrink-0">
              ${profile?.avatar_url
                ? `<img src="${profile.avatar_url}" alt="" class="w-full h-full object-cover" />`
                : `<span class="material-symbols-outlined text-xl text-primary">person</span>`
              }
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-heading text-heading-sm text-dark-text truncate">${profile?.display_name || 'Player'}</p>
              <p class="text-body-sm text-dark-text-muted">${profile?.email || ''}</p>
            </div>
            <span class="px-3 py-1 rounded-lg bg-success/10 text-success text-label-sm">Signed In</span>
          </div>

          <!-- Group Info -->
          ${group ? `
            <div class="p-4 rounded-xl bg-primary/10 border border-primary/20 mb-6">
              <div class="flex items-center gap-3 mb-2">
                <span class="material-symbols-outlined text-primary">info</span>
                <span class="font-heading text-heading-sm text-dark-text">${group.name}</span>
              </div>
              <p class="text-body-sm text-dark-text-muted ml-9">Code: <span class="font-mono text-primary">${group.code}</span></p>
              <p class="text-body-sm text-dark-text-muted ml-9">Status: ${group.status}</p>
            </div>

            <button id="join-group-btn" class="w-full py-3.5 btn-primary text-body-md flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-lg">login</span>
              Join Game
            </button>
          ` : `
            <div class="space-y-3">
              <label class="text-label-sm text-dark-text-muted block">INVITE CODE</label>
              <input id="join-code-input" type="text" maxlength="30" placeholder="e.g. clever-tiger-42"
                class="input-glass uppercase" />
              <button id="lookup-group-btn" class="w-full py-3.5 btn-secondary text-body-md">
                Find & Join
              </button>
            </div>
          `}
        `}
      </div>

      <button onclick="window.location.hash='#/'" class="text-body-sm text-dark-text-muted hover:text-dark-text transition-colors">
        ← Back to Home
      </button>
    </div>
  `;

  if (user && group) {
    container.querySelector('#join-group-btn').addEventListener('click', async () => {
      const btn = container.querySelector('#join-group-btn');
      btn.disabled = true;
      btn.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Joining...';

      try {
        const { joinGroup } = await import('../supabase.js');
        await joinGroup(code);
        store.set('currentGroup', group);
        showToast('success', `Joined "${group.name}"!`);
        navigate(`/lobby/${group.id}`);
      } catch (error) {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined text-lg">login</span> Join Game`;
        showToast('error', error.message);
      }
    });
  }

  if (user && !group) {
    container.querySelector('#lookup-group-btn')?.addEventListener('click', async () => {
      const codeInput = container.querySelector('#join-code-input');
      const inputCode = codeInput.value.trim();
      if (!inputCode) {
        showToast('error', 'Please enter an invite code.');
        return;
      }

      try {
        const foundGroup = await getGroupByCode(inputCode);
        if (!foundGroup) {
          showToast('error', 'Group not found. Check the code.');
          return;
        }
        navigate(`/join/${inputCode}`);
      } catch (error) {
        showToast('error', error.message);
      }
    });
  }
}
