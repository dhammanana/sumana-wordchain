import store from '../store.js';
import { navigate } from '../router.js';
import { supabase, getCurrentUser, subscribeToGame, startGame, leaveGame } from '../supabase.js';
import { showToast } from '../utils/ui.js';

/**
 * LobbyView - Waiting room before game starts
 */
export default async function LobbyView(container, params) {
  const groupId = params.id;
  store.set('currentView', '/lobby');

  if (groupId === 'solo') {
    navigate('/play/solo');
    return;
  }

  container.innerHTML = `
    <div class="flex flex-col items-center py-4 animate-fade-in-up">
      <div id="lobby-loading" class="flex flex-col items-center justify-center py-20">
        <div class="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-body-md text-dark-text-muted">Loading lobby...</p>
      </div>

      <div id="lobby-content" class="hidden w-full space-y-5">
        <!-- Header -->
        <div class="glass-card p-6 text-center">
          <div class="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
            <span class="material-symbols-outlined text-2xl text-primary" style="font-variation-settings:'FILL'1">meeting_room</span>
          </div>
          <h2 id="lobby-group-name" class="font-heading text-heading-md text-dark-text mb-1">Game Lobby</h2>
          <p class="text-body-sm text-dark-text-muted">
            Code: <span id="lobby-group-code" class="font-mono text-primary font-bold"></span>
          </p>
          <span class="inline-block mt-2 px-3 py-1 rounded-lg bg-warning-container text-warning text-label-sm">Waiting Room</span>
        </div>

        <!-- Players -->
        <div class="glass-card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-heading text-heading-sm text-dark-text flex items-center gap-2">
              <span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL'1">groups</span>
              Players
            </h3>
            <span id="player-count" class="text-label-sm text-dark-text-muted">0 players</span>
          </div>
          <div id="member-list" class="space-y-2">
            <div class="flex items-center gap-3 p-3 rounded-xl bg-glass">
              <div class="skeleton w-10 h-10 rounded-xl"></div>
              <div class="skeleton h-5 w-32 rounded"></div>
            </div>
          </div>
        </div>

        <!-- Game Mode -->
        <div class="glass-card p-6">
          <h3 class="font-heading text-heading-sm text-dark-text flex items-center gap-2 mb-4">
            <span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL'1">auto_stories</span>
            Game Mode
          </h3>
          <div id="mode-info" class="flex items-center gap-3 p-3 rounded-xl bg-glass">
            <span id="mode-icon" class="material-symbols-outlined text-2xl text-primary">timer</span>
            <div>
              <p id="mode-name" class="font-heading text-heading-sm text-dark-text">Guided Turns</p>
              <p id="mode-description" class="text-body-sm text-dark-text-muted">Take turns with a gentle timer.</p>
            </div>
          </div>
        </div>

        <!-- Host Controls -->
        <div id="host-controls" class="hidden glass-card p-6 space-y-4">
          <h3 class="font-heading text-heading-sm text-dark-text">Session Settings</h3>
          <div id="timer-settings" class="flex items-center justify-between">
            <label class="text-body-sm text-dark-text-muted">Turn Timer</label>
            <div class="flex gap-1 flex-wrap">
              <button class="timer-option px-3 py-1.5 rounded-lg text-label-sm bg-glass text-dark-text-muted border border-glass-border transition-all hover:bg-glass-light" data-seconds="5">5s</button>
              <button class="timer-option px-3 py-1.5 rounded-lg text-label-sm bg-glass text-dark-text-muted border border-glass-border transition-all hover:bg-glass-light" data-seconds="10">10s</button>
              <button class="timer-option px-3 py-1.5 rounded-lg text-label-sm bg-glass text-dark-text-muted border border-glass-border transition-all hover:bg-glass-light" data-seconds="15">15s</button>
              <button class="timer-option px-3 py-1.5 rounded-lg text-label-sm bg-glass text-dark-text-muted border border-glass-border transition-all hover:bg-glass-light" data-seconds="20">20s</button>
              <button class="timer-option px-3 py-1.5 rounded-lg text-label-sm bg-glass text-dark-text-muted border border-glass-border transition-all hover:bg-glass-light" data-seconds="30">30s</button>
              <button class="timer-option px-3 py-1.5 rounded-lg text-label-sm bg-glass text-dark-text-muted border border-glass-border transition-all hover:bg-glass-light" data-seconds="45">45s</button>
              <button class="timer-option px-3 py-1.5 rounded-lg text-label-sm bg-primary/15 text-primary border border-primary/20 transition-all" data-seconds="60">60s</button>
            </div>
          </div>

          <!-- Host Rules -->
          <div class="border-t border-glass-border pt-4 space-y-4">
            <p class="text-label-sm text-dark-text-muted font-semibold">WORD RULES</p>

            <label class="flex items-center justify-between gap-3">
              <span class="text-body-sm text-dark-text">Win at score</span>
              <input id="rule-win-score" type="number" min="0" step="10" placeholder="no limit"
                class="w-24 px-2 py-1.5 rounded-lg bg-glass border border-glass-border text-body-sm text-dark-text outline-none" />
            </label>

            <label class="flex items-center justify-between gap-3">
              <span class="text-body-sm text-dark-text">Min word length</span>
              <input id="rule-min-length" type="number" min="2" max="15" value="2"
                class="w-24 px-2 py-1.5 rounded-lg bg-glass border border-glass-border text-body-sm text-dark-text outline-none" />
            </label>

            <label class="flex items-center justify-between gap-3">
              <span class="text-body-sm text-dark-text">Banned vowels</span>
              <input id="rule-banned-vowels" type="text" placeholder="e.g. a,e"
                class="w-32 px-2 py-1.5 rounded-lg bg-glass border border-glass-border text-body-sm text-dark-text outline-none uppercase" />
            </label>

            <label class="flex items-center justify-between gap-3">
              <span class="text-body-sm text-dark-text">Banned endings</span>
              <input id="rule-banned-suffixes" type="text" placeholder="e.g. ing"
                class="w-32 px-2 py-1.5 rounded-lg bg-glass border border-glass-border text-body-sm text-dark-text outline-none lowercase" />
            </label>

            <label class="flex items-center justify-between gap-3">
              <span class="text-body-sm text-dark-text">Allow only</span>
              <select id="rule-allowed-pos" class="px-2 py-1.5 rounded-lg bg-glass border border-glass-border text-body-sm text-dark-text outline-none">
                <option value="">Any word</option>
                <option value="noun">Nouns</option>
                <option value="verb">Verbs</option>
                <option value="adjective">Adjectives</option>
              </select>
            </label>

            <label class="flex items-center gap-3 cursor-pointer">
              <input id="rule-dead-mode" type="checkbox" class="w-4 h-4 accent-primary" />
              <span class="text-body-sm text-dark-text">Dead mode (timeout = lose)</span>
            </label>

            <label class="flex items-center gap-3 cursor-pointer">
              <input id="rule-combat-mode" type="checkbox" class="w-4 h-4 accent-primary" />
              <span class="text-body-sm text-dark-text">Combat mode (wager gems)</span>
            </label>

            <label class="flex items-center justify-between gap-3">
              <span class="text-body-sm text-dark-text">Gem wager</span>
              <input id="rule-gem-wager" type="number" min="0" step="1" value="0"
                class="w-24 px-2 py-1.5 rounded-lg bg-glass border border-glass-border text-body-sm text-dark-text outline-none" />
            </label>
          </div>

          <button id="start-game-btn" class="w-full py-3.5 btn-primary text-body-md flex items-center justify-center gap-2">
            <span class="material-symbols-outlined" style="font-variation-settings:'FILL'1">play_arrow</span>
            Start Game
          </button>
        </div>

        <!-- Waiting message (non-host) -->
        <div id="waiting-message" class="hidden glass-card p-6 text-center">
          <div class="w-12 h-12 rounded-xl bg-glass flex items-center justify-center mx-auto mb-3">
            <span class="material-symbols-outlined text-2xl text-dark-text-muted">hourglass_empty</span>
          </div>
          <p class="font-heading text-heading-sm text-dark-text mb-1">Waiting for host to start...</p>
          <p class="text-body-sm text-dark-text-muted">Share the invite code with your friends!</p>
        </div>

        <!-- Invite Link -->
        <div class="glass-card p-6">
          <p class="text-label-sm text-dark-text-muted mb-2">INVITE LINK</p>
          <div class="flex items-center gap-2">
            <input id="invite-link-input" type="text" readonly
              class="flex-1 px-3 py-3 rounded-lg bg-glass border border-glass-border text-body-sm text-dark-text font-mono outline-none" />
            <button id="copy-invite-btn" class="px-4 py-3 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 transition-all">
              <span class="material-symbols-outlined text-lg">content_copy</span>
            </button>
          </div>
        </div>

        <!-- Leave -->
        <button id="leave-lobby-btn" class="w-full py-3 text-body-sm text-dark-text-muted hover:text-error transition-colors">
          Leave Lobby
        </button>
      </div>
    </div>
  `;

  let unsubscribe = null;
  let currentGroup = null;
  let user = null;

  try {
    user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { getGroupWithMembers } = await import('../supabase.js');
    const group = await getGroupWithMembers(groupId);

    if (!group) {
      container.innerHTML = `<div class="text-center py-20"><p class="text-error">Group not found.</p></div>`;
      return;
    }

    currentGroup = group;
    store.set('currentGroup', group);

    // Check membership
    if (!group.members?.some(m => m.player_id === user.id)) {
      container.innerHTML = `
        <div class="text-center py-20 animate-fade-in">
          <p class="text-body-md text-dark-text-muted mb-4">You are not a member of this group.</p>
          <a href="#/join/${group.code}" class="px-8 py-3.5 btn-primary text-body-md">Join this Group</a>
        </div>
      `;
      return;
    }

    container.querySelector('#lobby-loading').classList.add('hidden');
    container.querySelector('#lobby-content').classList.remove('hidden');

    renderGroupInfo(group);

    const isHost = group.host_id === user.id;
    if (isHost) {
      container.querySelector('#host-controls').classList.remove('hidden');
    } else {
      container.querySelector('#waiting-message').classList.remove('hidden');
    }

    // Invite link
    const inviteLink = `${window.location.origin}/wordchain/#/join/${group.code}`;
    container.querySelector('#invite-link-input').value = inviteLink;

    container.querySelector('#copy-invite-btn').onclick = () => {
      navigator.clipboard.writeText(inviteLink).then(() => {
        const btn = container.querySelector('#copy-invite-btn');
        btn.innerHTML = '<span class="material-symbols-outlined text-lg">check</span>';
        setTimeout(() => {
          btn.innerHTML = '<span class="material-symbols-outlined text-lg">content_copy</span>';
        }, 2000);
        showToast('success', 'Link copied!');
      });
    };

    // Timer selection
    let selectedSeconds = group.turn_seconds || 60;
    container.querySelectorAll('.timer-option').forEach(btn => {
      const secs = parseInt(btn.dataset.seconds, 10);
      if (secs === selectedSeconds) {
        btn.classList.add('bg-primary/15', 'text-primary', 'border-primary/20');
        btn.classList.remove('bg-glass', 'text-dark-text-muted', 'border-glass-border');
      }
      btn.addEventListener('click', () => {
        selectedSeconds = secs;
        container.querySelectorAll('.timer-option').forEach(b => {
          b.classList.remove('bg-primary/15', 'text-primary', 'border-primary/20');
          b.classList.add('bg-glass', 'text-dark-text-muted', 'border-glass-border');
        });
        btn.classList.add('bg-primary/15', 'text-primary', 'border-primary/20');
        btn.classList.remove('bg-glass', 'text-dark-text-muted', 'border-glass-border');
        supabase.from('groups').update({ turn_seconds: selectedSeconds }).eq('id', groupId);
        const modeDesc = container.querySelector('#mode-description');
        if (modeDesc) modeDesc.textContent = `Take turns with a ${selectedSeconds}-second timer.`;
      });
    });

    // Start game
    container.querySelector('#start-game-btn').addEventListener('click', async () => {
      const btn = container.querySelector('#start-game-btn');
      btn.disabled = true;
      btn.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Starting...';

      try {
        // Read host-configured rules and persist them to the group
        const winScore = parseInt(container.querySelector('#rule-win-score').value, 10) || null;
        const minLength = parseInt(container.querySelector('#rule-min-length').value, 10) || 2;
        const bannedVowels = container.querySelector('#rule-banned-vowels').value
          .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const bannedSuffixes = container.querySelector('#rule-banned-suffixes').value
          .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const allowedPos = container.querySelector('#rule-allowed-pos').value
          ? [container.querySelector('#rule-allowed-pos').value] : [];
        const deadMode = container.querySelector('#rule-dead-mode').checked;
        const combatMode = container.querySelector('#rule-combat-mode').checked;
        const gemWager = parseInt(container.querySelector('#rule-gem-wager').value, 10) || 0;

        await supabase.from('groups').update({
          win_score: winScore,
          min_length: minLength,
          banned_vowels: bannedVowels.join(','),
          banned_suffixes: bannedSuffixes.join(','),
          allowed_pos: allowedPos.join(','),
          dead_mode: deadMode,
          combat_mode: combatMode,
          gem_wager: gemWager,
        }).eq('id', groupId);

        await startGame(groupId);
        navigate(`/play/${groupId}`);
      } catch (error) {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-variation-settings:'FILL'1">play_arrow</span> Start Game`;
        showToast('error', error.message);
      }
    });

    // Leave
    container.querySelector('#leave-lobby-btn').addEventListener('click', async () => {
      if (confirm('Leave this lobby?')) {
        try { await leaveGame(groupId); } catch (e) { /* ignore */ }
        navigate('/');
      }
    });

    // Subscribe to realtime
    unsubscribe = await subscribeToGame(groupId, {
      onGroupUpdated: (updatedGroup) => {
        currentGroup = { ...currentGroup, ...updatedGroup };
        store.set('currentGroup', currentGroup);

        if (updatedGroup.status === 'active' && !isHost) {
          navigate(`/play/${groupId}`);
        }
      },
      onMembersChanged: async () => {
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

    // Poll fallback
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
            navigate(`/play/${groupId}`);
          }
        } catch (e) {}
      }
      if (pollCount > 30 || group.status !== 'waiting') {
        clearInterval(pollInterval);
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      if (unsubscribe) unsubscribe();
    };

  } catch (error) {
    container.innerHTML = `
      <div class="text-center py-20 animate-fade-in">
        <div class="w-16 h-16 rounded-2xl bg-error-container flex items-center justify-center mx-auto mb-4">
          <span class="material-symbols-outlined text-3xl text-error">error</span>
        </div>
        <p class="text-body-md text-dark-text-muted">${error.message}</p>
        <button onclick="window.location.hash='#/'" class="mt-6 px-8 py-3.5 btn-primary text-body-md">Go Home</button>
      </div>
    `;
  }

  function renderGroupInfo(group) {
    container.querySelector('#lobby-group-name').textContent = group.name || 'Study Room';
    container.querySelector('#lobby-group-code').textContent = group.code;
    container.querySelector('#player-count').textContent = `${group.members?.length || 0} player${group.members?.length !== 1 ? 's' : ''}`;

    const modeInfo = {
      turns_timed: { name: 'Timed Turns', desc: `Take turns with a ${group.turn_seconds || 60}-second timer.`, icon: 'timer' },
      turns_relaxed: { name: 'Relaxed Turns', desc: 'No time pressure. Take your time.', icon: 'self_improvement' },
      free_for_all: { name: 'Open Practice', desc: 'Anyone can add words anytime.', icon: 'diversity_3' },
    };
    const mode = modeInfo[group.game_mode] || modeInfo.turns_timed;
    const modeIcon = container.querySelector('#mode-icon');
    const modeName = container.querySelector('#mode-name');
    const modeDesc = container.querySelector('#mode-description');
    if (modeIcon) modeIcon.textContent = mode.icon;
    if (modeName) modeName.textContent = mode.name;
    if (modeDesc) modeDesc.textContent = mode.desc;

    const timerSettings = container.querySelector('#timer-settings');
    if (timerSettings) {
      timerSettings.classList.toggle('hidden', group.game_mode !== 'turns_timed');
    }

    const memberList = container.querySelector('#member-list');
    if (group.members?.length > 0) {
      memberList.innerHTML = group.members.map((m, i) => {
        const profile = m.profiles || {};
        const isHostPlayer = m.player_id === group.host_id;
        const displayName = profile.display_name || 'Player ' + (i + 1);
        const avatarUrl = profile.avatar_url;

        return `
          <div class="glass-hover p-3 rounded-xl flex items-center justify-between transition-all">
            <div class="flex items-center gap-3">
              <div class="relative">
                <div class="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center overflow-hidden font-heading text-heading-sm text-primary font-bold">
                  ${avatarUrl
                    ? `<img src="${avatarUrl}" alt="" class="w-full h-full object-cover" />`
                    : displayName.slice(0, 2).toUpperCase()
                  }
                </div>
                ${isHostPlayer ? '<span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-warning flex items-center justify-center text-[8px]">👑</span>' : ''}
              </div>
              <div>
                <p class="font-heading text-heading-sm text-dark-text">${displayName}</p>
                <p class="text-label-sm text-dark-text-muted">${isHostPlayer ? 'Host' : 'Player'}</p>
              </div>
            </div>
            <span class="w-2 h-2 rounded-full bg-success" title="Online"></span>
          </div>
        `;
      }).join('');
    }
  }
}