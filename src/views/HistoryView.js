/**
 * HistoryView - Game history for the current user
 *
 * Shows past games the user participated in with:
 * - Group name, code, date
 * - Your score and ranking
 * - Words you played
 * - Overall game status
 */
import store from '../store.js';
import { navigate } from '../router.js';
import { getGameHistory, getGroupHistory, ensureAuth } from '../supabase.js';
import { openDictionary } from '../components/DictionaryModal.js';
import { formatTimeAgo } from '../utils/ui.js';

export default async function HistoryView(container, params) {
  store.set('currentView', '/history');

  container.innerHTML = `
    <div class="flex flex-col gap-gap-lg pb-28">
      <div class="flex items-center justify-between">
        <h2 class="font-headline-md text-headline-md">Game History</h2>
        <span class="px-3 py-1 bg-surface-container-high text-outline font-label-caps text-label-caps rounded-full">All time</span>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 border-b border-outline-variant/30 pb-2">
        <button id="tab-games" class="tab-btn px-gap-md py-gap-sm rounded-lg font-label-caps text-label-caps bg-primary text-on-primary transition-all">Games</button>
        <button id="tab-words" class="tab-btn px-gap-md py-gap-sm rounded-lg font-label-caps text-label-caps bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-all">My Words</button>
      </div>

      <!-- Loading -->
      <div id="history-loading" class="flex flex-col items-center justify-center py-20">
        <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="font-body-md text-body-md text-on-surface-variant">Loading your history...</p>
      </div>

      <!-- Games Tab Content -->
      <div id="games-content" class="hidden space-y-gap-md">
        <div id="games-empty" class="hidden text-center py-16 bg-surface-container-lowest border border-outline-variant rounded-2xl">
          <span class="material-symbols-outlined text-5xl text-outline mb-3" style="font-variation-settings:'FILL'1">sports_esports</span>
          <h3 class="font-headline-sm text-headline-sm mb-2">No games yet</h3>
          <p class="font-body-md text-body-md text-on-surface-variant mb-4">Join or create a game to see your history here.</p>
          <button onclick="window.location.hash='#/'"
            class="px-6 py-3 bg-primary text-on-primary rounded-xl btn-shadow font-headline-sm">
            Play a Game
          </button>
        </div>
        <div id="games-list" class="space-y-gap-md"></div>
      </div>

      <!-- Words Tab Content -->
      <div id="words-content" class="hidden space-y-gap-md">
        <p class="font-body-md text-body-md text-on-surface-variant">Words you've played across all games.</p>
        <div id="words-empty" class="hidden text-center py-16 bg-surface-container-lowest border border-outline-variant rounded-2xl">
          <span class="material-symbols-outlined text-5xl text-outline mb-3" style="font-variation-settings:'FILL'1">abc</span>
          <h3 class="font-headline-sm text-headline-sm mb-2">No words yet</h3>
          <p class="font-body-md text-body-md text-on-surface-variant">Your played words will appear here.</p>
        </div>
        <div id="words-list" class="space-y-gap-sm"></div>
      </div>

      <!-- Error state -->
      <div id="history-error" class="hidden text-center py-16">
        <span class="material-symbols-outlined text-5xl text-error mb-3">error</span>
        <p class="font-body-md text-body-md text-on-surface-variant" id="history-error-msg">Could not load history.</p>
        <button id="retry-btn" class="mt-4 px-6 py-3 bg-primary text-on-primary rounded-xl btn-shadow">
          Try Again
        </button>
      </div>
    </div>
  `;

  // --- Tab switching ---
  container.querySelector('#tab-games').addEventListener('click', () => {
    switchTab('games');
  });
  container.querySelector('#tab-words').addEventListener('click', () => {
    switchTab('words');
  });

  function switchTab(tab) {
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('bg-primary', 'text-on-primary');
      btn.classList.add('bg-surface-container', 'text-on-surface-variant');
    });

    const activeTab = container.querySelector(`#tab-${tab}`);
    activeTab.classList.add('bg-primary', 'text-on-primary');
    activeTab.classList.remove('bg-surface-container', 'text-on-surface-variant');

    container.querySelector('#games-content').classList.toggle('hidden', tab !== 'games');
    container.querySelector('#words-content').classList.toggle('hidden', tab !== 'words');
  }

  // --- Load data ---
  try {
    const user = await ensureAuth();
    if (!user) throw new Error('Not authenticated');

    const [groupHistory, wordHistory] = await Promise.all([
      getGroupHistory(),
      getGameHistory(),
    ]);

    container.querySelector('#history-loading').classList.add('hidden');

    // Render games
    if (groupHistory && groupHistory.length > 0) {
      renderGames(groupHistory);
    } else {
      container.querySelector('#games-empty').classList.remove('hidden');
    }

    // Render words
    if (wordHistory && wordHistory.length > 0) {
      renderWords(wordHistory);
    } else {
      container.querySelector('#words-empty').classList.remove('hidden');
    }

    container.querySelector('#games-content').classList.remove('hidden');

  } catch (error) {
    container.querySelector('#history-loading').classList.add('hidden');
    container.querySelector('#history-error').classList.remove('hidden');
    container.querySelector('#history-error-msg').textContent = error.message;

    container.querySelector('#retry-btn').addEventListener('click', () => {
      navigate('/history');
    });
  }

  // --- Render functions ---

  function renderGames(history) {
    const list = container.querySelector('#games-list');

    list.innerHTML = history.map(item => {
      const g = item.groups || {};
      const statusBadge = g.status === 'finished'
        ? '<span class="px-2 py-0.5 bg-surface-container text-outline text-[10px] font-bold uppercase rounded-full">Ended</span>'
        : g.status === 'active'
        ? '<span class="px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase rounded-full">Active</span>'
        : '<span class="px-2 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-bold uppercase rounded-full">Waiting</span>';

      const playerScore = item.score || 0;

      return `
        <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg hover:shadow-sm transition-all">
          <div class="flex items-start justify-between mb-gap-sm">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="material-symbols-outlined text-primary text-sm">group</span>
                <h3 class="font-headline-sm text-headline-sm truncate">${g.name || 'Unknown Game'}</h3>
              </div>
              <p class="font-label-caps text-label-caps text-outline">
                Code: ${g.code || '---'} · ${formatDate(item.joined_at)}
              </p>
            </div>
            ${statusBadge}
          </div>
          <div class="flex items-center gap-gap-md mt-gap-md pt-gap-md border-t border-outline-variant/20">
            <div class="flex-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-sm text-primary" style="font-variation-settings:'FILL'1">trophy</span>
              <span class="font-headline-sm text-headline-sm text-primary font-bold">${playerScore}</span>
              <span class="font-label-caps text-label-caps text-outline">pts</span>
            </div>
            <button class="text-sm text-primary font-label-caps text-label-caps hover:underline" onclick="window.location.hash='#/lobby/${g.id}'">
              View Game
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderWords(wordHistory) {
    const list = container.querySelector('#words-list');

    // Group words by game
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
        <div class="flex items-center justify-between p-gap-sm bg-surface-container rounded-lg hover:bg-surface-container-high transition-all cursor-pointer" onclick="window.__openDictionary && window.__openDictionary('${w.word}')">
          <div class="flex items-center gap-2">
            <span class="font-headline-sm text-headline-sm text-primary font-bold">${w.word}</span>
            <span class="font-label-caps text-label-caps text-outline">+${w.points || 0}</span>
          </div>
          <span class="font-label-caps text-label-caps text-outline">${formatTimeAgo(w.created_at)}</span>
        </div>
      `).join('');

      return `
        <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg">
          <div class="flex items-center justify-between mb-gap-md">
            <div>
              <h3 class="font-headline-sm text-headline-sm">${data.groupName}</h3>
              <p class="font-label-caps text-label-caps text-outline">${data.groupCode} · ${data.words.length} word${data.words.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div class="space-y-gap-sm">
            ${wordsHtml}
          </div>
        </div>
      `;
    }).join('');

    // Wire up dictionary lookup
    window.__openDictionary = (word) => {
      openDictionary(word);
    };
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

  // formatTimeAgo imported from utils/ui.js
}
