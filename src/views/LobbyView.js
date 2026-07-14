import store from '../store.js';
import { navigate } from '../router.js';
import { supabase, ensureAuth, getProfile, subscribeToGame, isGroupMember, startGame } from '../supabase.js';
import { showToast } from '../utils/ui.js';

/**
 * Lobby view - Waiting room before game starts
 * Shows: member list, ready status, host can start game
 */
export default async function LobbyView(container, params) {
  const groupId = params.id;
  store.set('currentView', '/lobby');

  // For solo mode, redirect to play
  if (groupId === 'solo') {
    navigate('/play/solo');
    return;
  }

  container.innerHTML = `
    <div class="flex flex-col items-center py-4">
      <!-- Loading state -->
      <div id="lobby-loading" class="flex flex-col items-center justify-center py-20">
        <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="font-body-md text-body-md text-on-surface-variant">Loading lobby...</p>
      </div>

      <!-- Lobby content (hidden until loaded) -->
      <div id="lobby-content" class="hidden w-full space-y-gap-lg animate-slide-up">
        <!-- Header -->
        <div class="text-center">
          <div class="flex items-center justify-center gap-2 mb-2">
            <span class="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold uppercase rounded-full">Waiting Room</span>
          </div>
          <h2 class="font-headline-md text-headline-md" id="lobby-group-name">Game Lobby</h2>
          <p class="font-body-md text-body-md text-on-surface-variant mt-1">
            Code: <span id="lobby-group-code" class="font-mono font-bold text-primary"></span>
          </p>
        </div>

        <!-- Member List -->
        <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg">
          <div class="flex items-center justify-between mb-gap-md">
            <h3 class="font-headline-sm text-headline-sm flex items-center gap-2">
              <span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL'1">groups</span>
              Players
            </h3>
            <span id="player-count" class="font-label-caps text-label-caps text-outline">0 players</span>
          </div>
          <div id="member-list" class="space-y-gap-sm">
            <!-- Member items rendered here -->
            <div class="flex items-center gap-gap-md p-gap-md bg-surface-container rounded-xl animate-pulse">
              <div class="w-10 h-10 rounded-full skeleton"></div>
              <div class="flex-1">
                <div class="skeleton h-5 w-32 rounded"></div>
                <div class="skeleton h-3 w-20 rounded mt-1"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Study Mode Info -->
        <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg">
          <h3 class="font-headline-sm text-headline-sm flex items-center gap-2 mb-gap-md">
            <span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL'1">auto_stories</span>
            Study Mode
          </h3>
          <div id="mode-info" class="flex items-center gap-gap-md p-gap-md bg-surface-container rounded-xl">
            <span id="mode-icon" class="material-symbols-outlined text-primary text-2xl">timer</span>
            <div>
              <p id="mode-name" class="font-headline-sm text-headline-sm">Guided Turns</p>
              <p id="mode-description" class="font-label-caps text-label-caps text-outline">Take turns with a gentle timer.</p>
            </div>
          </div>
        </div>

        <!-- Game Settings (Host only) -->
        <div id="host-controls" class="hidden bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg">
          <h3 class="font-headline-sm text-headline-sm mb-gap-md">Session Settings</h3>
          <div id="timer-settings" class="flex items-center justify-between mb-gap-md">
            <label class="font-body-md text-body-md">Turn Timer</label>
            <div class="flex gap-1">
              <button class="timer-option px-3 py-1.5 rounded-lg font-label-caps text-label-caps bg-surface-container-highest text-on-surface-variant" data-seconds="30">30s</button>
              <button class="timer-option px-3 py-1.5 rounded-lg font-label-caps text-label-caps bg-primary-container text-on-primary-container" data-seconds="60">60s</button>
              <button class="timer-option px-3 py-1.5 rounded-lg font-label-caps text-label-caps bg-surface-container-highest text-on-surface-variant" data-seconds="90">90s</button>
            </div>
          </div>
          <button id="start-game-btn" class="w-full py-4 bg-secondary text-on-secondary font-headline-sm text-headline-sm rounded-xl btn-tactile transition-all flex items-center justify-center gap-md">
            <span class="material-symbols-outlined" style="font-variation-settings:'FILL'1">play_arrow</span>
            Begin Study Session
          </button>
        </div>

        <!-- Waiting message (non-host) -->
        <div id="waiting-message" class="bg-surface-container rounded-2xl p-gap-lg text-center">
          <span class="material-symbols-outlined text-4xl text-outline mb-2">hourglass_empty</span>
          <p class="font-headline-sm text-headline-sm text-on-surface-variant">Waiting for host to start...</p>
          <p class="font-body-md text-body-md text-outline mt-1">Share the group code with your friends!</p>
        </div>

        <!-- Link sharing -->
        <div class="bg-surface-container-high rounded-2xl p-gap-lg">
          <p class="font-label-caps text-label-caps text-outline mb-2">INVITE LINK</p>
          <div class="flex items-center gap-2">
            <input id="invite-link-input" type="text" readonly
              class="flex-1 px-gap-md py-3 bg-surface-container-lowest border border-outline-variant rounded-xl font-mono text-sm text-primary outline-none truncate" />
            <button id="copy-invite-btn" class="px-4 py-3 bg-primary-container text-on-primary-container rounded-xl hover:brightness-110 transition-all">
              <span class="material-symbols-outlined text-sm">content_copy</span>
            </button>
          </div>
        </div>

        <!-- Back button -->
        <button id="leave-lobby-btn" class="w-full py-3 text-outline font-label-caps text-label-caps hover:text-error transition-colors">
          Leave Lobby
        </button>
      </div>
    </div>
  `;

  let unsubscribe = null;
  let currentGroup = null;
  let user = null;

  try {
    user = await ensureAuth();
    if (!user) throw new Error('Not authenticated');

    // Fetch group and members
    const { getGroupWithMembers } = await import('../supabase.js');
    const group = await getGroupWithMembers(groupId);

    if (!group) {
      container.innerHTML = `<div class="text-center py-20"><p class="text-error">Group not found.</p></div>`;
      return;
    }

    currentGroup = group;
    store.set('currentGroup', group);

    // Check if user is a member
    if (!group.members?.some(m => m.player_id === user.id)) {
      container.innerHTML = `
        <div class="text-center py-20">
          <p class="font-body-md text-body-md text-on-surface-variant mb-4">You are not a member of this group.</p>
          <button onclick="window.location.hash='#/join/${group.code}'" class="px-6 py-3 bg-primary text-on-primary rounded-xl btn-shadow">Join this Group</button>
        </div>
      `;
      return;
    }

    container.querySelector('#lobby-loading').classList.add('hidden');
    container.querySelector('#lobby-content').classList.remove('hidden');

    // Render member list and group info
    renderGroupInfo(group);

    // Check if user is host
    const isHost = group.host_id === user.id;
    if (isHost) {
      container.querySelector('#host-controls').classList.remove('hidden');
      container.querySelector('#waiting-message').classList.add('hidden');
    } else {
      container.querySelector('#waiting-message').classList.remove('hidden');
    }

    // Set invite link
    const inviteLink = `${window.location.origin}/wordchain/#/join/${group.code}`;
    container.querySelector('#invite-link-input').value = inviteLink;

    // Copy invite link
    container.querySelector('#copy-invite-btn').onclick = () => {
      navigator.clipboard.writeText(inviteLink).then(() => {
        const btn = container.querySelector('#copy-invite-btn');
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">check</span>';
        setTimeout(() => {
          btn.innerHTML = '<span class="material-symbols-outlined text-sm">content_copy</span>';
        }, 2000);
      });
    };

    // Timer selection
    container.querySelectorAll('.timer-option').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.timer-option').forEach(b => {
          b.classList.remove('bg-primary-container', 'text-on-primary-container');
          b.classList.add('bg-surface-container-highest', 'text-on-surface-variant');
        });
        btn.classList.add('bg-primary-container', 'text-on-primary-container');
        btn.classList.remove('bg-surface-container-highest', 'text-on-surface-variant');
      });
    });

    // Start game
    container.querySelector('#start-game-btn').addEventListener('click', async () => {
      const btn = container.querySelector('#start-game-btn');
      btn.disabled = true;
      btn.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Starting...';

      try {
        await startGame(groupId);
        // Navigate immediately — don't wait for Realtime to fire
        navigate(`/play/${groupId}`);
      } catch (error) {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-variation-settings:'FILL'1">play_arrow</span> Start Game`;
        showToast('error', error.message);
      }
    });

    // Leave lobby
    container.querySelector('#leave-lobby-btn').addEventListener('click', () => {
      if (confirm('Leave this lobby?')) {
        navigate('/');
      }
    });

    // Subscribe to realtime updates
    unsubscribe = await subscribeToGame(groupId, {
      onGroupUpdated: (updatedGroup) => {
        currentGroup = { ...currentGroup, ...updatedGroup };
        store.set('currentGroup', currentGroup);

        if (updatedGroup.status === 'active' && !isHost) {
          // Non-host players navigate via Realtime (host navigates immediately)
          navigate(`/play/${groupId}`);
        }
      },
      onMembersChanged: async () => {
        // Refresh member list
        const { getGroupWithMembers } = await import('../supabase.js');
        const updated = await getGroupWithMembers(groupId);
        currentGroup = updated;
        store.set('currentGroup', updated);
        renderGroupInfo(updated);
      },
      onStatus: (status) => {
        if (status === 'SUBSCRIBED') {
          store.set('connectionStatus', 'connected');
        }
      }
    });

    // Fallback: poll for game start if not host (in case Realtime isn't enabled)
    let pollCount = 0;
    const pollInterval = setInterval(async () => {
      if (!isHost && group.status === 'waiting') {
        pollCount++;
        try {
          const { data } = await supabase
            .from('groups')
            .select('status')
            .eq('id', groupId)
            .single();
          if (data?.status === 'active') {
            clearInterval(pollInterval);
            store.set('currentGroup', { ...currentGroup, ...data });
            navigate(`/play/${groupId}`);
          }
        } catch (e) {
          // Silently retry
        }
      }
      if (pollCount > 30 || group.status !== 'waiting') {
        clearInterval(pollInterval);
      }
    }, 2000);

    // Also clear pollInterval on cleanup
    const origCleanup = () => {
      if (unsubscribe) unsubscribe();
    };
    const cleanupWrapper = () => {
      clearInterval(pollInterval);
      origCleanup();
    };
    // Replace the returned cleanup
    return cleanupWrapper;

  } catch (error) {
    container.innerHTML = `
      <div class="text-center py-20">
        <span class="material-symbols-outlined text-6xl text-error mb-4">error</span>
        <p class="font-body-md text-body-md">${error.message}</p>
        <button onclick="window.location.hash='#/'" class="mt-4 px-6 py-3 bg-primary text-on-primary rounded-xl btn-shadow">Go Home</button>
      </div>
    `;
  }

  function renderGroupInfo(group) {
    container.querySelector('#lobby-group-name').textContent = group.name || 'Study Room';
    container.querySelector('#lobby-group-code').textContent = group.code;
    container.querySelector('#player-count').textContent = `${group.members?.length || 0} student${group.members?.length !== 1 ? 's' : ''}`;

    // Update mode info
    const modeInfo = {
      turns_timed: { name: 'Guided Turns', desc: 'Take turns with a gentle timer.', icon: 'timer' },
      turns_relaxed: { name: 'Relaxed Turns', desc: 'Turn-based with no time pressure. Study at your own pace.', icon: 'self_improvement' },
      free_for_all: { name: 'Open Practice', desc: 'Anyone can add words anytime. Perfect for shared learning.', icon: 'diversity_3' },
    };
    const mode = modeInfo[group.game_mode] || modeInfo.turns_timed;
    const modeIcon = container.querySelector('#mode-icon');
    const modeName = container.querySelector('#mode-name');
    const modeDesc = container.querySelector('#mode-description');
    if (modeIcon) modeIcon.textContent = mode.icon;
    if (modeName) modeName.textContent = mode.name;
    if (modeDesc) modeDesc.textContent = mode.desc;

    // Show/hide timer settings based on mode
    const timerSettings = container.querySelector('#timer-settings');
    if (timerSettings) {
      if (group.game_mode === 'turns_timed') {
        timerSettings.classList.remove('hidden');
      } else {
        timerSettings.classList.add('hidden');
      }
    }

    const memberList = container.querySelector('#member-list');
    if (group.members && group.members.length > 0) {
      // Colors for avatar initials (deterministic based on player_id)
      const avatarColors = ['bg-primary text-on-primary', 'bg-secondary text-on-secondary', 'bg-tertiary text-on-tertiary', 'bg-error text-on-error'];
      function getAvatarColor(id) {
        let hash = 0;
        for (let i = 0; i < (id || '').length; i++) {
          const char = (id || '').charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash |= 0;
        }
        return avatarColors[Math.abs(hash) % avatarColors.length];
      }

      memberList.innerHTML = group.members.map((m, i) => {
        const profile = m.profiles || {};
        const isHostPlayer = m.player_id === group.host_id;
        const displayName = profile.display_name || 'Student ' + (i + 1);

        return `
          <div class="flex items-center justify-between p-gap-md bg-surface-container rounded-xl hover:bg-surface-container-high transition-all">
            <div class="flex items-center gap-gap-md">
              <div class="relative">
                <div class="w-10 h-10 rounded-full ${getAvatarColor(m.player_id)} flex items-center justify-center font-bold text-sm">${displayName.slice(0, 2).toUpperCase()}</div>
                ${isHostPlayer ? '<span class="absolute -top-1 -right-1 text-xs">👑</span>' : ''}
              </div>
              <div>
                <p class="font-headline-sm text-headline-sm">${displayName}</p>
                <p class="font-label-caps text-label-caps text-outline">${isHostPlayer ? 'Host' : 'Student'}</p>
              </div>
            </div>
            <span class="w-2 h-2 rounded-full bg-secondary" title="Online"></span>
          </div>
        `;
      }).join('');
    }
  }

  // Cleanup on unmount
  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}

// showToast imported from utils/ui.js
