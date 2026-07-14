/**
 * PlayView - The main study arena for WordChain
 *
 * Features:
 * - Real-time multiplayer word chain study
 * - Three modes: Guided Turns (timed), Relaxed Turns (untimed), Open Practice (anyone anytime)
 * - Turn timer with countdown (turns_timed only)
 * - Word submission with validation
 * - Chain visualization
 * - Progress tracking
 * - Solo study with bot opponent
 *
 * Design note: This app is for monks and Buddhist practitioners.
 * Terminology uses "study", "practice", "learn" rather than "game".
 * UI is calm and mindful, designed for collaborative vocabulary learning.
 */
import store from '../store.js';
import { navigate } from '../router.js';
import { ensureAuth, getGroupWithMembers, submitWord, getGameWords, subscribeToGame, skipTurn } from '../supabase.js';
import { getWordsStartingWith, isValidWord, checkChainRule, getLastLetter, hasProfanity, calculateScore } from '../utils/words.js';
import { openDictionary } from '../components/DictionaryModal.js';
import { fetchDefinition } from '../utils/dictionary.js';
import { showToast, formatTimeAgo } from '../utils/ui.js';

let turnTimer = null;
let secondsLeft = 60;

// Descriptive labels for each study mode
const MODE_LABELS = {
  turns_timed: { label: 'Guided Turns', icon: 'timer', desc: 'Take turns with a gentle timer.' },
  turns_relaxed: { label: 'Relaxed Turns', icon: 'self_improvement', desc: 'No time pressure — study at your own pace.' },
  free_for_all: { label: 'Open Practice', icon: 'diversity_3', desc: 'Anyone can add words anytime.' },
};

export default async function PlayView(container, params) {
  const gameId = params.id;
  const isSolo = gameId === 'solo';
  store.set('currentView', '/play');

  container.innerHTML = `
    <div class="flex flex-col items-center gap-gap-lg pb-28">
      <!-- Loading State -->
      <div id="play-loading" class="flex flex-col items-center justify-center py-20 w-full">
        <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="font-body-md text-body-md text-on-surface-variant">Preparing study session...</p>
      </div>

      <!-- Study Content (hidden until loaded) -->
      <div id="play-content" class="hidden w-full space-y-gap-lg animate-slide-up">
        <!-- Study Header -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-headline-md text-headline-md" id="game-title">Study Session</h2>
            <p class="font-body-md text-body-md text-on-surface-variant" id="game-subtitle"></p>
          </div>
          <div class="flex items-center gap-3">
            <!-- Mode Badge -->
            <span id="mode-badge" class="px-3 py-1 bg-surface-container-high text-outline font-label-caps text-label-caps rounded-full hidden"></span>
            <button id="dictionary-btn" class="px-gap-md py-gap-sm bg-surface-container-high text-primary rounded-xl font-label-caps text-label-caps hover:bg-primary-container/20 transition-all flex items-center gap-1" title="Look up a word">
              <span class="material-symbols-outlined text-sm">menu_book</span>
              Dictionary
            </button>
          </div>
        </div>

        <!-- Timer Bar (only visible for turns_timed mode) -->
        <div id="timer-container" class="hidden bg-surface-container-high rounded-2xl p-gap-md overflow-hidden">
          <div class="flex items-center justify-between mb-2">
            <span class="font-label-caps text-label-caps text-outline uppercase">Your Turn</span>
            <span id="timer-display" class="font-headline-sm text-headline-sm font-bold">60s</span>
          </div>
          <div class="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div id="timer-bar" class="h-full bg-primary rounded-full transition-all duration-1000 ease-linear" style="width: 100%"></div>
          </div>
        </div>

        <!-- Turn Indicator - hidden for free_for_all mode -->
        <div id="turn-indicator" class="flex items-center gap-gap-md p-gap-md bg-surface-container-lowest border border-outline-variant rounded-xl">
          <div id="turn-dot" class="w-3 h-3 rounded-full bg-secondary animate-pulse"></div>
          <div>
            <p id="turn-text" class="font-body-md text-body-md">Waiting for session to start...</p>
            <p id="required-letter-display" class="font-label-caps text-label-caps text-outline hidden">Next word must start with: <span id="required-letter" class="font-bold text-primary text-lg"></span></p>
          </div>
        </div>

        <!-- Progress Board -->
        <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
          <div class="px-gap-lg py-gap-md bg-primary-container/10">
            <h3 class="font-headline-sm text-headline-sm flex items-center gap-2">
              <span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL'1">leaderboard</span>
              Progress Board
            </h3>
          </div>
          <div id="scoreboard" class="p-gap-lg space-y-gap-sm">
            <!-- Score items rendered here -->
          </div>
        </div>

        <!-- Word Input & Submit - always visible for free_for_all; shown/hidden for turn modes -->
        <div id="word-input-area" class="hidden bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg">
          <label class="font-label-caps text-label-caps text-outline mb-2 block" for="word-input">YOUR WORD</label>
          <div class="flex flex-col sm:flex-row gap-gap-md">
            <div class="flex-1 relative">
              <span id="input-letter-prefix" class="absolute left-4 top-1/2 -translate-y-1/2 font-headline-md text-headline-md text-primary font-bold hidden"></span>
              <input id="word-input" type="text" autocomplete="off" autocorrect="off" spellcheck="false"
                placeholder="Type your word..."
                class="w-full px-gap-md py-4 bg-surface-container-high border-2 border-outline-variant focus:border-primary focus:ring-0 rounded-xl font-input-text text-input-text uppercase outline-none transition-all" />
            </div>
            <button id="submit-word-btn" class="px-gap-lg py-4 bg-primary text-on-primary font-headline-sm text-headline-sm rounded-xl btn-shadow transition-all flex items-center justify-center gap-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none" disabled>
              <span class="material-symbols-outlined" style="font-variation-settings:'FILL'1">check_circle</span>
              Submit
            </button>
          </div>
          <p id="word-feedback" class="font-body-md text-body-md text-on-surface-variant mt-2 hidden"></p>
        </div>

        <!-- Word Chain Display -->
        <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-gap-lg">
          <div class="flex items-center justify-between mb-gap-md">
            <h3 class="font-headline-sm text-headline-sm flex items-center gap-2">
              <span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL'1">link</span>
              Word Chain
            </h3>
            <span id="chain-count" class="font-label-caps text-label-caps text-outline">0 words</span>
          </div>
          <div id="chain-container" class="max-h-[400px] overflow-y-auto word-chain-scroll">
            <div id="chain-empty" class="text-center py-8">
              <span class="material-symbols-outlined text-4xl text-outline mb-2">empty_dashboard</span>
              <p class="font-body-md text-body-md text-on-surface-variant">No words yet. Be the first to contribute!</p>
            </div>
            <div id="chain-list" class="space-y-gap-sm hidden">
              <!-- Chain items rendered here in reverse order (newest first) -->
            </div>
          </div>
        </div>

        <!-- Solo Mode specific -->
        <div id="solo-controls" class="hidden">
          <button id="new-solo-game-btn" class="w-full py-4 bg-secondary text-on-secondary font-headline-sm text-headline-sm rounded-xl btn-tactile transition-all flex items-center justify-center gap-md">
            <span class="material-symbols-outlined" style="font-variation-settings:'FILL'1">refresh</span>
            New Practice Session
          </button>
        </div>

        <!-- Leave -->
        <button id="leave-game-btn" class="w-full py-3 text-outline font-label-caps text-label-caps hover:text-error transition-colors">
          Leave Session
        </button>
      </div>
    </div>
  `;

  // --- State ---
  let currentGameId = gameId;
  let myUserId = null;
  let myProfile = null;
  let group = null;
  let words = [];
  let isMyTurn = false;
  let unsubscribe = null;
  let gameActive = false;
  let currentLetter = null;
  let botTimer = null;
  let gameMode = 'turns_timed'; // 'turns_timed' | 'turns_relaxed' | 'free_for_all'

  try {
    const user = await ensureAuth();
    if (!user) throw new Error('Not authenticated');
    myUserId = user.id;
    myProfile = store.get('profile');

    if (isSolo) {
      initSoloMode();
    } else {
      await initMultiplayerMode();
    }
  } catch (error) {
    container.querySelector('#play-loading').classList.add('hidden');
    container.querySelector('#play-content').classList.add('hidden');
    container.innerHTML = `
      <div class="text-center py-20">
        <span class="material-symbols-outlined text-6xl text-error mb-4">error</span>
        <p class="font-body-md text-body-md">${error.message}</p>
        <button onclick="window.location.hash='#/'"
          class="mt-4 px-6 py-3 bg-primary text-on-primary rounded-xl btn-shadow">Go Home</button>
      </div>
    `;
  }

  // =========================================================
  // SOLO MODE
  // =========================================================
  function initSoloMode() {
    container.querySelector('#game-title').textContent = 'Solo Practice';
    container.querySelector('#game-subtitle').textContent = 'Practice with the word bot';
    container.querySelector('#solo-controls').classList.remove('hidden');

    group = {
      id: 'solo',
      name: 'Solo Practice',
      status: 'active',
      current_turn_player_id: myUserId,
      current_letter: null,
    };

    updateSoloScoreboard({ player: 0, bot: 0 });

    container.querySelector('#play-loading').classList.add('hidden');
    container.querySelector('#play-content').classList.remove('hidden');

    gameActive = true;
    isMyTurn = true;
    currentLetter = null;
    showWordInput();
    updateTurnIndicator();

    botTimer = null;

    setupWordInput();
    setupLeaveButton();
    setupDictionaryButton();
    setupNewSoloGame();
  }

  function updateSoloScoreboard(scores) {
    const board = container.querySelector('#scoreboard');
    board.innerHTML = `
      <div class="flex items-center justify-between p-gap-md bg-surface-container rounded-xl">
        <div class="flex items-center gap-gap-md">
          <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold">
            <span class="material-symbols-outlined">person</span>
          </div>
          <div>
            <p class="font-headline-sm text-headline-sm">${myProfile?.display_name || 'You'}</p>
            <p class="font-label-caps text-label-caps text-outline">Student</p>
          </div>
        </div>
        <span class="font-headline-md text-headline-md font-bold text-primary">${scores.player}</span>
      </div>
      <div class="flex items-center justify-between p-gap-md bg-surface-container rounded-xl">
        <div class="flex items-center gap-gap-md">
          <div class="w-10 h-10 rounded-full bg-tertiary flex items-center justify-center text-on-tertiary font-bold">
            <span class="material-symbols-outlined">smart_toy</span>
          </div>
          <div>
            <p class="font-headline-sm text-headline-sm">Word Bot</p>
            <p class="font-label-caps text-label-caps text-outline">Practice Partner</p>
          </div>
        </div>
        <span class="font-headline-md text-headline-md font-bold text-tertiary">${scores.bot}</span>
      </div>
    `;
  }

  function botPlay(lastLetter) {
    if (!gameActive) return;

    isMyTurn = false;
    hideWordInput();
    showTimer(false);

    botTimer = setTimeout(() => {
      if (!gameActive) return;

      let botWord = '';

      if (lastLetter) {
        const candidates = getWordsStartingWith(lastLetter);
        const used = new Set(words.map(w => w.word.toLowerCase()));
        const available = candidates.filter(w => !used.has(w.toLowerCase()));
        if (available.length > 0) {
          botWord = available[Math.floor(Math.random() * available.length)];
        } else {
          botWord = '';
        }
      } else {
        const candidates = ['cat', 'dog', 'sun', 'run', 'big', 'red', 'hat', 'pen', 'cup', 'bed'];
        botWord = candidates[Math.floor(Math.random() * candidates.length)];
      }

      if (botWord) {
        const wordUpper = botWord.toUpperCase();
        const points = calculateScore(botWord, true);
        addWordToChain({
          word: wordUpper,
          points,
          player_name: 'Word Bot',
          is_bot: true,
          created_at: new Date().toISOString(),
        });

        currentLetter = getLastLetter(wordUpper);
        isMyTurn = true;
        showWordInput();
        updateTurnIndicator();
        startTurnTimer(60);

        updateChainCount();
      } else {
        addWordToChain({
          word: '🤖 Bot gave up!',
          points: 0,
          player_name: 'Word Bot',
          is_bot: true,
          is_message: true,
          created_at: new Date().toISOString(),
        });
        gameActive = false;
        showToast('success', 'You win! The bot couldn\'t find a word.');
        disableGameControls();
      }

      updateChainCount();
    }, 1500 + Math.random() * 2000);
  }

  function setupNewSoloGame() {
    container.querySelector('#new-solo-game-btn').addEventListener('click', () => {
      stopTimer();
      words = [];
      gameActive = true;
      currentLetter = null;
      isMyTurn = true;
      updateSoloScoreboard({ player: 0, bot: 0 });

      container.querySelector('#chain-list').innerHTML = '';
      container.querySelector('#chain-list').classList.add('hidden');
      container.querySelector('#chain-empty').classList.remove('hidden');
      updateChainCount();

      container.querySelector('#word-input').value = '';
      container.querySelector('#word-feedback').classList.add('hidden');

      showWordInput();
      updateTurnIndicator();
      showTimer(false);

      if (botTimer) {
        clearTimeout(botTimer);
        botTimer = null;
      }

      showToast('success', 'New practice session started!');
    });
  }

  // =========================================================
  // MULTIPLAYER MODE
  // =========================================================
  async function initMultiplayerMode() {
    try {
      group = await getGroupWithMembers(currentGameId);
    } catch (e) {
      throw new Error('Could not load study session data. It may have ended.');
    }

    if (!group) throw new Error('Study session not found.');

    // Set game mode from the group data
    gameMode = group.game_mode || 'turns_timed';

    container.querySelector('#game-title').textContent = group.name || 'Study Session';
    container.querySelector('#game-subtitle').textContent = `Code: ${group.code || ''} · ${MODE_LABELS[gameMode]?.label || 'Study'}`;

    // Show mode badge
    const modeBadge = container.querySelector('#mode-badge');
    if (modeBadge) {
      modeBadge.textContent = MODE_LABELS[gameMode]?.label || 'Study';
      modeBadge.classList.remove('hidden');
      // Style based on mode
      if (gameMode === 'free_for_all') {
        modeBadge.className = 'px-3 py-1 bg-secondary-container/20 text-secondary font-label-caps text-label-caps rounded-full';
      } else if (gameMode === 'turns_relaxed') {
        modeBadge.className = 'px-3 py-1 bg-tertiary-container/20 text-tertiary font-label-caps text-label-caps rounded-full';
      } else {
        modeBadge.className = 'px-3 py-1 bg-surface-container-high text-outline font-label-caps text-label-caps rounded-full';
      }
    }

    // For free_for_all and turns_relaxed: always show input
    // The DB trigger enforces turn order regardless — non-turn players
    // get a friendly error if they try to submit. But the box is always
    // visible so players in an async session can see it when they open the page.
    if (gameMode === 'free_for_all' || gameMode === 'turns_relaxed') {
      showWordInput();
      if (gameMode === 'free_for_all') {
        container.querySelector('#turn-indicator').classList.add('hidden');
      }
    }

    renderScoreboard(group.members || []);

    try {
      words = await getGameWords(currentGameId);
      renderChain(words);
    } catch (e) {
      console.warn('Could not load words:', e.message);
    }

    container.querySelector('#play-loading').classList.add('hidden');
    container.querySelector('#play-content').classList.remove('hidden');

    if (group.status === 'active') {
      gameActive = true;
      checkTurn();
    } else if (group.status === 'waiting') {
      gameActive = false;
      container.querySelector('#turn-text').textContent = '⏳ Waiting for host to start the session...';
    } else if (group.status === 'finished') {
      gameActive = false;
      container.querySelector('#turn-text').textContent = 'Session completed!';
      disableGameControls();
    }

    setupWordInput();
    setupLeaveButton();
    setupDictionaryButton();

    unsubscribe = await subscribeToGame(currentGameId, {
      onWordInserted: (newWord) => {
        getGameWords(currentGameId).then(updatedWords => {
          words = updatedWords;
          renderChain(updatedWords);

          if (newWord.player_id !== myUserId) {
            currentLetter = getLastLetter(newWord.word);
          }
          checkTurn();
        }).catch(() => {});

        updateChainCount();
      },
      onGroupUpdated: (updatedGroup) => {
        group = { ...group, ...updatedGroup };

        if (updatedGroup.status === 'active' && !gameActive) {
          gameActive = true;
          showToast('success', 'Session started!');
          checkTurn();
        }

        if (updatedGroup.status === 'finished') {
          gameActive = false;
          showToast('info', 'Session ended.');
          disableGameControls();
          container.querySelector('#turn-text').textContent = '📚 Session Complete!';
          updateTurnIndicator();
        }

        if (updatedGroup.current_turn_player_id) {
          group.current_turn_player_id = updatedGroup.current_turn_player_id;
          if (updatedGroup.current_letter) {
            currentLetter = updatedGroup.current_letter;
          }
          checkTurn();
        }
      },
      onMembersChanged: () => {
        getGroupWithMembers(currentGameId).then(updated => {
          group = updated;
          renderScoreboard(updated.members || []);
        }).catch(() => {});
      },
      onStatus: (status) => {
        if (status === 'SUBSCRIBED') {
          store.set('connectionStatus', 'connected');
        }
      }
    });
  }

  function checkTurn() {
    if (!gameActive) return;

    currentLetter = group.current_letter || null;
    isMyTurn = group.current_turn_player_id === myUserId;

    // free_for_all and turns_relaxed: input is always visible
    // The DB trigger enforces who can actually submit.
    if (gameMode === 'free_for_all' || gameMode === 'turns_relaxed') {
      showTimer(false);
      updateTurnIndicator();
      return;
    }

    // turns_timed: input visible only on your turn, with timer
    if (isMyTurn) {
      showWordInput();
      startTurnTimer(group.turn_seconds || 60);
    } else {
      hideWordInput();
      showTimer(false);
    }

    updateTurnIndicator();
  }

  // =========================================================
  // SHARED UI FUNCTIONS
  // =========================================================

  function setupWordInput() {
    const input = container.querySelector('#word-input');
    const submitBtn = container.querySelector('#submit-word-btn');
    const feedback = container.querySelector('#word-feedback');

    input.addEventListener('input', () => {
      const prefix = container.querySelector('#input-letter-prefix');
      if (currentLetter) {
        prefix.textContent = currentLetter.toUpperCase();
        prefix.classList.remove('hidden');
        input.style.paddingLeft = '2.5rem';
      } else {
        prefix.classList.add('hidden');
        input.style.paddingLeft = '';
      }

      feedback.classList.add('hidden');
      submitBtn.disabled = input.value.trim().length < 2;
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submitBtn.click();
      }
    });

    submitBtn.addEventListener('click', async () => {
      const word = input.value.trim().toUpperCase();
      if (!word || word.length < 2) {
        showWordFeedback('Word must be at least 2 letters long.', 'error');
        return;
      }

      if (hasProfanity(word)) {
        showWordFeedback('Please keep it clean! 🙈', 'error');
        return;
      }

      if (!checkChainRule(word, currentLetter)) {
        showWordFeedback(`Word must start with \"${currentLetter.toUpperCase()}\"!`, 'error');
        return;
      }

      if (!isValidWord(word)) {
        try {
          await fetchDefinition(word);
        } catch {
          showWordFeedback(`\"${word}\" is not a recognized English word.`, 'error');
          return;
        }
      }

      const wordLower = word.toLowerCase();
      const isDuplicate = words.some(w => w.word?.toLowerCase() === wordLower || w.word_lower === wordLower);
      if (isDuplicate) {
        showWordFeedback(`\"${word}\" has already been used!`, 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>';

      try {
        if (isSolo) {
          const points = calculateScore(word, true);
          addWordToChain({
            word: word,
            points,
            player_name: myProfile?.display_name || 'You',
            is_bot: false,
            created_at: new Date().toISOString(),
          });
          input.value = '';
          feedback.classList.add('hidden');
          updateChainCount();

          const currentScores = getSoloScores();
          currentScores.player += points;
          updateSoloScoreboard(currentScores);

          stopTimer();
          currentLetter = getLastLetter(word);
          showTimer(false);
          botPlay(currentLetter);
        } else {
          const data = await submitWord(currentGameId, word);
          input.value = '';
          feedback.classList.add('hidden');
          showToast('success', `\"${word}\" submitted! +${data.points || word.length - 2} pts`);
        }
      } catch (error) {
        showWordFeedback(error.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined" style="font-variation-settings:\'FILL\'1">check_circle</span> Submit';
      }
    });
  }

  function setupLeaveButton() {
    container.querySelector('#leave-game-btn').addEventListener('click', () => {
      if (confirm('Leave this study session?')) {
        cleanup();
        navigate('/');
      }
    });
  }

  function setupDictionaryButton() {
    const dictBtn = container.querySelector('#dictionary-btn');
    dictBtn.addEventListener('click', async () => {
      const word = container.querySelector('#word-input').value.trim().toUpperCase();
      if (word) {
        openDictionary(word);
      } else {
        openDictionary('dictionary');
      }
    });
  }

  function renderScoreboard(members) {
    const board = container.querySelector('#scoreboard');
    if (!members || members.length === 0) {
      board.innerHTML = '<p class="font-body-md text-body-md text-outline text-center py-4">No students yet.</p>';
      return;
    }

    const sorted = [...members].sort((a, b) => (b.score || 0) - (a.score || 0));

    board.innerHTML = sorted.map((m, i) => {
      const p = m.profiles || {};
      const isMe = m.player_id === myUserId;
      const isCurrent = gameMode !== 'free_for_all' && m.player_id === group?.current_turn_player_id;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';

      return `
        <div class="flex items-center justify-between p-gap-md bg-surface-container rounded-xl ${isMe ? 'ring-2 ring-primary/30' : ''} ${isCurrent ? 'animate-pulse-border' : ''}">
          <div class="flex items-center gap-gap-md min-w-0">
            <span class="font-headline-sm text-headline-sm text-outline w-5 flex-shrink-0">${medal || (i + 1)}</span>
            <div class="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-sm flex-shrink-0">
              ${(p.display_name || 'Player ' + (i + 1)).slice(0, 2).toUpperCase()}
            </div>
            <div class="min-w-0">
              <p class="font-headline-sm text-headline-sm truncate">${p.display_name || 'Student ' + (i + 1)} ${isMe ? '(You)' : ''}</p>
              <p class="font-label-caps text-label-caps text-outline">${isCurrent ? '🔵 Contributing...' : ''}</p>
            </div>
          </div>
          <span class="font-headline-md text-headline-md font-bold text-primary flex-shrink-0 ml-2">${m.score || 0}</span>
        </div>
      `;
    }).join('');
  }

  function getSoloScores() {
    const scores = { player: 0, bot: 0 };
    for (const w of words) {
      if (w.is_bot) scores.bot += w.points || 0;
      else scores.player += w.points || 0;
    }
    return scores;
  }

  function addWordToChain(wordData) {
    words = [wordData, ...words];
    renderChain(words);
  }

  function renderChain(wordsArray) {
    const list = container.querySelector('#chain-list');
    const empty = container.querySelector('#chain-empty');

    if (!wordsArray || wordsArray.length === 0) {
      list.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.classList.remove('hidden');

    list.innerHTML = wordsArray.map((w, idx) => {
      const isLast = idx === 0;
      const nextWord = idx < wordsArray.length - 1 ? wordsArray[idx + 1] : null;
      const startLetter = nextWord ? nextWord.word[0] : '?';
      const isBot = w.is_bot;
      const isMessage = w.is_message;

      if (isMessage) {
        return `
          <div class="flex items-center justify-center py-2 opacity-60">
            <span class="font-body-md text-body-md italic">${w.word}</span>
          </div>
        `;
      }

      return `
        <div class="flex items-center gap-gap-md p-gap-md bg-surface-container rounded-xl ${isLast ? 'ring-2 ring-primary/20' : ''} ${isBot ? 'bg-tertiary-container/5' : ''}">
          <div class="flex-shrink-0 w-8 h-8 rounded-full ${isBot ? 'bg-tertiary/20 text-tertiary' : 'bg-primary/20 text-primary'} flex items-center justify-center font-bold text-sm">
            ${isBot ? '🤖' : '👤'}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-headline-sm text-headline-sm font-bold ${isLast ? 'text-primary' : ''}">${w.word}</span>
              ${isLast ? '<span class=\"px-2 py-0.5 bg-primary text-on-primary text-[10px] font-bold uppercase rounded-full\">NEW</span>' : ''}
            </div>
            <p class="font-label-caps text-label-caps text-outline">
              ${w.player_name || w.profiles?.display_name || 'Student'} · +${w.points || 0} pts
              · ${formatTimeAgo(w.created_at)}
            </p>
          </div>
          <button class="lookup-word text-outline hover:text-primary transition-colors p-1" data-word="${w.word}">
            <span class="material-symbols-outlined text-sm">search</span>
          </button>
        </div>
        ${nextWord ? `
          <div class="flex items-center gap-2 pl-12 -mt-1 mb-1">
            <div class="w-px h-4 bg-primary/30"></div>
            <span class="text-xs font-bold text-primary">Must start with: ${startLetter}</span>
          </div>
        ` : ''}
      `;
    }).join('');

    list.querySelectorAll('.lookup-word').forEach(btn => {
      btn.addEventListener('click', () => {
        openDictionary(btn.dataset.word);
      });
    });

    const chainContainer = container.querySelector('#chain-container');
    chainContainer.scrollTop = 0;
  }

  function updateChainCount() {
    container.querySelector('#chain-count').textContent = `${words.length} word${words.length !== 1 ? 's' : ''}`;
  }

  function updateTurnIndicator() {
    const turnText = container.querySelector('#turn-text');
    const letterDisplay = container.querySelector('#required-letter-display');
    const requiredLetter = container.querySelector('#required-letter');

    if (!gameActive) {
      turnText.textContent = '⏸️ Session paused';
      return;
    }

    if (gameMode === 'free_for_all') {
      turnText.textContent = words.length > 0
        ? '🌿 Open practice — add any word that follows the chain!'
        : '🌿 Open practice — be the first to add a word!';
    } else if (gameMode === 'turns_relaxed') {
      if (isMyTurn) {
        turnText.textContent = '🎯 Your turn — the word box is ready for you! (No pressure, take your time.)';
      } else {
        const currentPlayer = group?.members?.find(m => m.player_id === group?.current_turn_player_id);
        const name = currentPlayer?.profiles?.display_name || 'Another student';
        turnText.textContent = `⏳ ${name} is up next. You can try submitting, but the chain expects their word first.`;
      }
    } else if (isMyTurn) {
      turnText.textContent = '🎯 Your turn! Type a word!';
    } else {
      const currentPlayer = group?.members?.find(m => m.player_id === group?.current_turn_player_id);
      const name = currentPlayer?.profiles?.display_name || 'Another student';
      turnText.textContent = `⏳ Waiting for ${name}...`;
    }

    if (currentLetter && gameActive) {
      letterDisplay.classList.remove('hidden');
      requiredLetter.textContent = currentLetter.toUpperCase();
    } else {
      letterDisplay.classList.add('hidden');
    }
  }

  function showWordInput() {
    const area = container.querySelector('#word-input-area');
    if (area) area.classList.remove('hidden');
  }

  function hideWordInput() {
    const area = container.querySelector('#word-input-area');
    if (area) area.classList.add('hidden');
  }

  function showTimer(visible) {
    const timerContainer = container.querySelector('#timer-container');
    if (timerContainer) {
      if (visible) {
        timerContainer.classList.remove('hidden');
      } else {
        timerContainer.classList.add('hidden');
      }
    }
  }

  function startTurnTimer(seconds) {
    stopTimer();
    showTimer(true);

    secondsLeft = seconds || 60;
    const timerDisplay = container.querySelector('#timer-display');
    const timerBar = container.querySelector('#timer-bar');

    if (timerDisplay) timerDisplay.textContent = `${secondsLeft}s`;
    if (timerBar) timerBar.style.width = '100%';

    turnTimer = setInterval(() => {
      secondsLeft--;
      if (timerDisplay) timerDisplay.textContent = `${secondsLeft}s`;
      if (timerBar) {
        const pct = (secondsLeft / (seconds || 60)) * 100;
        timerBar.style.width = `${pct}%`;

        if (secondsLeft <= 10) {
          timerBar.classList.remove('bg-primary');
          timerBar.classList.add('bg-error');
        } else if (secondsLeft <= 20) {
          timerBar.classList.remove('bg-primary', 'bg-error');
          timerBar.classList.add('bg-secondary');
        } else {
          timerBar.classList.remove('bg-error', 'bg-secondary');
          timerBar.classList.add('bg-primary');
        }
      }

      if (secondsLeft <= 0) {
        stopTimer();
        handleTimeOut();
      }
    }, 1000);
  }

  function stopTimer() {
    if (turnTimer) {
      clearInterval(turnTimer);
      turnTimer = null;
    }
  }

  function handleTimeOut() {
    if (isSolo) {
      showToast('info', 'Time\'s up! Starting a new round...');
      isMyTurn = false;
      hideWordInput();
      showTimer(false);
      updateTurnIndicator();
      disableGameControls();
      gameActive = false;
    } else {
      showToast('info', 'Time\'s up! Moving to next student...');
      isMyTurn = false;
      hideWordInput();
      showTimer(false);
      updateTurnIndicator();
      skipTurn(currentGameId).catch(() => {});
    }
  }

  function disableGameControls() {
    const input = container.querySelector('#word-input');
    const submitBtn = container.querySelector('#submit-word-btn');
    if (input) input.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
  }

  function enableGameControls() {
    const input = container.querySelector('#word-input');
    const submitBtn = container.querySelector('#submit-word-btn');
    if (input) input.disabled = false;
    if (submitBtn) submitBtn.disabled = false;
  }

  function showWordFeedback(message, type) {
    const feedback = container.querySelector('#word-feedback');
    if (feedback) {
      feedback.textContent = message;
      feedback.className = `font-body-md text-body-md mt-2 ${type === 'error' ? 'text-error' : 'text-on-surface-variant'}`;
      feedback.classList.remove('hidden');
    }
  }

  function cleanup() {
    stopTimer();
    if (botTimer) clearTimeout(botTimer);
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    store.set('currentGroup', null);
  }

  return () => {
    cleanup();
  };
}
