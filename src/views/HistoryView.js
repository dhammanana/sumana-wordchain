import store from '../store.js';
import { navigate } from '../router.js';
import { getGameHistory, getGroupHistory, getCurrentUser } from '../supabase.js';
import { openDictionary } from '../components/DictionaryModal.js';
import { formatTimeAgo } from '../utils/ui.js';

/**
 * HistoryView - Game history with stats
 */
export default async function HistoryView(container) {
  store.set('currentView', '/history');

  container.innerHTML = `
    <div class="flex flex-col gap-5 pb-28 animate-fade-in-up">
      <div class="flex items-center justify-between">
        <h2 class="font-heading text-heading-md text-dark-text">Game History</h2>
        <span class="px-3 py-1.5 rounded-lg bg-glass text-dark-text-muted text-label-sm">All time</span>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 p-1 rounded-xl bg-glass">
        <button id="tab-games" class="tab-btn flex-1 px-4 py-2 rounded-lg text-body-sm font-semibold bg-primary/15 text-primary transition-all">Games</button>
        <button id="tab-words" class="tab-btn flex-1 px-4 py-2 rounded-lg text-body-sm font-semibold text-dark-text-muted hover:text-dark-text transition-all">My Words</button>
      </div>

      <!-- Loading -->
      <div id="history-loading" class="flex flex-col items-center justify-center py-16">
        <div class="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-body-sm text-dark-text-muted">Loading your history...</p>
      </div>

      <!-- Games Tab -->
      <div id="games-content" class="hidden space-y-3">
        <div id="games-empty" class="hidden text-center py-16 glass-card">
          <div class="w-14 h-14 rounded-2xl bg-glass flex items-center justify-center mx-auto mb-4">
            <span class="material-symbols-outlined text-3xl text-dark-text-muted" style="font-variation-settings:'FILL'1">sports_esports</span>
          </div>
          <h3 class="font-heading text-heading-sm text-dark-text mb-2">No games yet</h3>
          <p class="text-body-sm text-dark-text-muted mb-4">Join or create a game to see your history here.</p>
          <a href="#/" class="inline-block px-6 py-2.5 btn-primary text-body-sm">Play a Game</a>
        </div>
        <div id="games-list" class="space-y-3"></div>
      </div>

      <!-- Words Tab -->
      <div id="words-content" class="hidden space-y-3">
        <div id="words-empty" class="hidden text-center py-16 glass-card">
          <div class="w-14 h-14 rounded-2xl bg-glass flex items-center justify-center mx-auto mb-4">
            <span class="material-symbols-outlined text-3xl text-dark-text-muted" style="font-variation-settings:'FILL'1">abc</span>
          </div>
          <h3 class="font-heading text-heading-sm text-dark-text mb-2">No words yet</h3>
          <p class="text-body-sm text-dark-text-muted">Your played words will appear here.</p>
        </div>
        <div id="words-list" class="space-y-2"></div>
      </div>

      <!-- Error -->
      <div id="history-error" class="hidden text-center py-16">
        <div class="w-14 h-14 rounded-2xl bg-error-container flex items-center justify-center mx-auto mb-4">
          <span class="material-symbols-outlined text-3xl text-error">error</span>
        </div>
        <p class="text-body-sm text-dark-text-muted" id="history-error-msg">Could not load history.</p>
        <button id="retry-btn" class="mt-6 px-6 py-2.5 btn-primary text-body-sm">Try Again</button>
      </div>
    </div>
  `;

  // Tab switching
  container.querySelector('#tab-games').addEventListener('click', () => switchTab('games'));
  container.querySelector('#tab-words').addEventListener('click', () => switchTab('words'));

  function switchTab(tab) {
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('bg-primary/15', 'text-primary');
      btn.classList.add('text-dark-text-muted');
    });
    const active = container.querySelector(`#tab-${tab}`);
    active.classList.add('bg-primary/15', 'text-primary');
    active.classList.remove('text-dark-text-muted');

    container.querySelector('#games-content').classList.toggle('hidden', tab !== 'games');
    container.querySelector('#words-content').classList.toggle('hidden', tab !== 'words');
  }

  // Load data
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const [groupHistory, wordHistory] = await Promise.all([
      getGroupHistory(user.id),
      getGameHistory(user.id),
    ]);

    container.querySelector('#history-loading').classList.add('hidden');

    if (groupHistory?.length > 0) {
      renderGames(groupHistory);
    } else {
      container.querySelector('#games-empty').classList.remove('hidden');
    }

    if (wordHistory?.length > 0) {
      renderWords(wordHistory);
    } else {
      container.querySelector('#words-empty').classList.remove('hidden');
    }

    container.querySelector('#games-content').classList.remove('hidden');

  } catch (error) {
    container.querySelector('#history-loading').classList.add('hidden');
    container.querySelector('#history-error').classList.remove('hidden');
    container.querySelector('#history-error-msg').textContent = error.message;
    container.querySelector('#retry-btn').addEventListener('click', () => navigate('/history'));
  }

  function renderGames(history) {
    const list = container.querySelector('#games-list');
    list.innerHTML = history.map(item => {
      const g = item.groups || {};
      const statusBadge = g.status === 'finished'
        ? '<span class="px-2 py-0.5 rounded-lg bg-glass text-dark-text-muted text-label-sm">Ended</span>'
        : g.status === 'active'
        ? '<span class="px-2 py-0.5 rounded-lg bg-success/10 text-success text-label-sm">Active</span>'
        : '<span class="px-2 py-0.5 rounded-lg bg-warning-container text-warning text-label-sm">Waiting</span>';

      const playerScore = item.score || 0;

      return `
        <div class="glass-card-hover p-4">
          <div class="flex items-start justify-between mb-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="material-symbols-outlined text-primary text-sm">group</span>
                <h3 class="font-heading text-heading-sm text-dark-text truncate">${g.name || 'Unknown Game'}</h3>
              </div>
              <p class="text-label-sm text-dark-text-muted">
                Code: ${g.code || '---'} · ${formatDate(item.joined_at)}
              </p>
            </div>
            ${statusBadge}
          </div>
          <div class="flex items-center gap-3 mt-3 pt-3 border-t border-glass-border">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm text-warning" style="font-variation-settings:'FILL'1">trophy</span>
              <span class="font-heading text-heading-sm text-dark-text font-bold">${playerScore}</span>
              <span class="text-label-sm text-dark-text-muted">pts</span>
            </div>
            <a href="#/lobby/${g.id}" class="ml-auto text-body-sm text-primary hover:underline">View Game</a>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderWords(wordHistory) {
    const list = container.querySelector('#words-list');

    const grouped = {};
    for (const w of wordHistory) {
      const groupId = w.group_id;
      if (!grouped[groupId]) {
        grouped[groupId] = {
          groupName: w.groups?.name || 'Unknown',
          groupCode: w.groups?.code || '---',
          words: [],
        };
      }
      grouped[groupId].words.push(w);
    }

    list.innerHTML = Object.entries(grouped).map(([groupId, data]) => {
      const wordsHtml = data.words.map(w => `
        <div class="flex items-center justify-between p-2.5 rounded-lg bg-glass hover:bg-glass-light transition-all cursor-pointer" onclick="window.__openDict && window.__openDict('${w.word}')">
          <div class="flex items-center gap-2.5">
            <span class="font-heading text-heading-sm text-dark-text font-bold">${w.word}</span>
            <span class="text-label-sm text-dark-text-muted">+${w.points || 0}</span>
          </div>
          <span class="text-label-sm text-dark-text-muted">${formatTimeAgo(w.created_at)}</span>
        </div>
      `).join('');

      return `
        <div class="glass-card p-4">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="font-heading text-heading-sm text-dark-text">${data.groupName}</h3>
              <p class="text-label-sm text-dark-text-muted">${data.groupCode} · ${data.words.length} word${data.words.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div class="space-y-1.5">
            ${wordsHtml}
          </div>
        </div>
      `;
    }).join('');

    window.__openDict = (word) => openDictionary(word);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}