/**
 * PlayView - The main game arena for WordChain
 *
 * Features:
 * - Real-time multiplayer word chain
 * - Turn timer with countdown
 * - Word submission with validation
 * - Chain visualization
 * - Score tracking
 * - Solo mode vs bot opponent
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

export default async function PlayView(container, params) {
  const gameId = params.id;
  const isSolo = gameId === 'solo';
  store.set('currentView', '/play');

  container.innerHTML = `
    <div class="flex flex-col items-center gap-gap-lg pb-28">
      <!-- Loading State -->
      <div id="play-loading" class="flex flex-col items-center justify-center py-20 w-full">
        <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="font-body-md text-body-md text-on-surface-variant">Preparing game arena...</p>
      </div>

      <!-- Game Content (hidden until loaded) -->
      <div id="play-content" class="hidden w-full space-y-gap-lg animate-slide-up">
        <!-- Game Header -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-headline-md text-headline-md" id="game-title">Game Arena</h2>
            <p class="font-body-md text-body-md text-on-surface-variant" id="game-subtitle"></p>
          </div>
          <div class="flex items-center gap-3">
            <button id="dictionary-btn" class="px-gap-md py-gap-sm bg-surface-container-high text-primary rounded-xl font-label-caps text-label-caps hover:bg-primary-container/20 transition-all flex items-center gap-1" title="Look up a word">
              <span class="material-symbols-outlined text-sm">menu_book</span>
              Dictionary
            </button>
          </div>
        </div>

        <!-- Timer Bar -->
        <div id="timer-container" class="hidden bg-surface-container-high rounded-2xl p-gap-md overflow-hidden">
          <div class="flex items-center justify-between mb-2">
            <span class="font-label-caps text-label-caps text-outline uppercase">Your Turn</span>
            <span id="timer-display" class="font-headline-sm text-headline-sm font-bold">60s</span>
          </div>
          <div class="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div id="timer-bar" class="h-full bg-primary rounded-full transition-all duration-1000 ease-linear" style="width: 100%"></div>
          </div>
        </div>

        <!-- Turn Indicator -->
        <div id="turn-indicator" class="flex items-center gap-gap-md p-gap-md bg-surface-container-lowest border border-outline-variant rounded-xl">
          <div class="w-3 h-3 rounded-full bg-secondary animate-pulse"></div>
          <div>
            <p id="turn-text" class="font-body-md text-body-md">Waiting for game to start...</p>
            <p id="required-letter-display" class="font-label-caps text-label-caps text-outline hidden">Next word must start with: <span id="required-letter" class="font-bold text-primary text-lg"></span></p>
          </div>
        </div>

        <!-- Scoreboard -->
        <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
          <div class="px-gap-lg py-gap-md bg-primary-container/10">
            <h3 class="font-headline-sm text-headline-sm flex items-center gap-2">
              <span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL'1">leaderboard</span>
              Scoreboard
            </h3>
          </div>
          <div id="scoreboard" class="p-gap-lg space-y-gap-sm">
            <!-- Score items rendered here -->
          </div>
        </div>

        <!-- Word Input & Submit -->
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
              <p class="font-body-md text-body-md text-on-surface-variant">No words played yet. Be the first!</p>
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
            New Solo Game
          </button>
        </div>

        <!-- Leave Game -->
        <button id="leave-game-btn" class="w-full py-3 text-outline font-label-caps text-label-caps hover:text-error transition-colors">
          Leave Game
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
    container.querySelector('#game-subtitle').textContent = 'Play against the bot!';
    container.querySelector('#solo-controls').classList.remove('hidden');

    group = {
      id: 'solo',
      name: 'Solo Practice',
      status: 'active',
      current_turn_player_id: myUserId,
      current_letter: null,
    };

    // Scoreboard: player + bot
    updateSoloScoreboard({ player: 0, bot: 0 });

    container.querySelector('#play-loading').classList.add('hidden');
    container.querySelector('#play-content').classList.remove('hidden');

    gameActive = true;
    isMyTurn = true;
    currentLetter = null;
    showWordInput();
    updateTurnIndicator();

    // Bot timer (delayed response)
    botTimer = null;

    // Setup controls
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
            <p class="font-label-caps text-label-caps text-outline">Player</p>
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
            <p class="font-label-caps text-label-caps text-outline">Computer</p>
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

    // Simulate bot thinking
    botTimer = setTimeout(() => {
      if (!gameActive) return;

      let botWord = '';

      if (lastLetter) {
        const candidates = getWordsStartingWith(lastLetter);
        // Pick a random word that hasn't been used
        const used = new Set(words.map(w => w.word.toLowerCase()));
        const available = candidates.filter(w => !used.has(w.toLowerCase()));
        if (available.length > 0) {
          botWord = available[Math.floor(Math.random() * available.length)];
        } else {
          // Bot couldn't find a word - it "loses" the round
          botWord = '';
        }
      } else {
        // First word: bot picks a random word
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

        // Update solo scores
        updateChainCount();
      } else {
        // Bot gives up
        addWordToChain({
          word: '🤖 Bot gave up!',
          points: 0,
          player_name: 'Word Bot',
          is_bot: true,
          is_message: true,
          created_at: new Date().toISOString(),
        });
        // Player wins this round
        gameActive = false;
        showToast('success', 'You win! The bot couldn\'t find a word.');
        disableGameControls();
      }

      updateChainCount();
    }, 1500 + Math.random() * 2000); // Bot "thinks" for 1.5-3.5 seconds
  }

  function setupNewSoloGame() {
    container.querySelector('#new-solo-game-btn').addEventListener('click', () => {
      stopTimer();
      // Reset solo game
      words = [];
      gameActive = true;
      currentLetter = null;
      isMyTurn = true;
      updateSoloScoreboard({ player: 0, bot: 0 });

      // Clear chain
      container.querySelector('#chain-list').innerHTML = '';
      container.querySelector('#chain-list').classList.add('hidden');
      container.querySelector('#chain-empty').classList.remove('hidden');
      updateChainCount();

      // Clear input
      container.querySelector('#word-input').value = '';
      container.querySelector('#word-feedback').classList.add('hidden');

      showWordInput();
      updateTurnIndicator();
      showTimer(false);

      if (botTimer) {
        clearTimeout(botTimer);
        botTimer = null;
      }

      showToast('success', 'New solo game started!');
    });
  }

  // =========================================================
  // MULTIPLAYER MODE
  // =========================================================
  async function initMultiplayerMode() {
    // Always fetch fresh game data — don't rely on stale store data
    try {
      group = await getGroupWithMembers(currentGameId);
    } catch (e) {
      throw new Error('Could not load game data. It may have ended.');
    }

    if (!group) throw new Error('Game not found.');

    container.querySelector('#game-title').textContent = group.name || 'Game';
    container.querySelector('#game-subtitle').textContent = `Code: ${group.code || ''}`;

    // Update scoreboard
    renderScoreboard(group.members || []);

    // Load existing words
    try {
      words = await getGameWords(currentGameId);
      renderChain(words);
    } catch (e) {
      console.warn('Could not load words:', e.message);
    }

    container.querySelector('#play-loading').classList.add('hidden');
    container.querySelector('#play-content').classList.remove('hidden');

    // Check game state
    if (group.status === 'active') {
      gameActive = true;
      checkTurn();
    } else if (group.status === 'waiting') {
      gameActive = false;
      container.querySelector('#turn-text').textContent = 'Waiting for host to start the game...';
    } else if (group.status === 'finished') {
      gameActive = false;
      container.querySelector('#turn-text').textContent = 'Game has ended!';
      disableGameControls();
    }

    // Setup controls
    setupWordInput();
    setupLeaveButton();
    setupDictionaryButton();

    // Subscribe to realtime updates
    unsubscribe = await subscribeToGame(currentGameId, {
      onWordInserted: (newWord) => {
        // Reload words to get full profile info
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
          showToast('info', 'Game started!');
          checkTurn();
        }

        if (updatedGroup.status === 'finished') {
          gameActive = false;
          showToast('info', 'Game has ended!');
          disableGameControls();
          container.querySelector('#turn-text').textContent = '🏁 Game Over!';
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

    const isMyTurnNow = group.current_turn_player_id === myUserId;
    currentLetter = group.current_letter || null;

    if (isMyTurnNow) {
      isMyTurn = true;
      showWordInput();
      startTurnTimer(group.turn_seconds || 60);
    } else {
      isMyTurn = false;
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

    // Live letter prefix hint
    input.addEventListener('input', () => {
      const prefix = container.querySelector('#input-letter-prefix');
      if (currentLetter && isMyTurn) {
        prefix.textContent = currentLetter.toUpperCase();
        prefix.classList.remove('hidden');
        input.style.paddingLeft = '2.5rem';
      } else {
        prefix.classList.add('hidden');
        input.style.paddingLeft = '';
      }

      // Clear feedback on new input
      feedback.classList.add('hidden');

      // Enable/disable submit
      submitBtn.disabled = input.value.trim().length < 2;
    });

    // Submit on Enter
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submitBtn.click();
      }
    });

    // Submit word
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
        showWordFeedback(`Word must start with "${currentLetter.toUpperCase()}"!`, 'error');
        return;
      }

      // Check if it's a real English word — local list first (instant), then API fallback
      if (!isValidWord(word)) {
        try {
          await fetchDefinition(word);
        } catch {
          showWordFeedback(`"${word}" is not a recognized English word.`, 'error');
          return;
        }
      }

      // Check for duplicates in current chain
      const wordLower = word.toLowerCase();
      const isDuplicate = words.some(w => w.word?.toLowerCase() === wordLower || w.word_lower === wordLower);
      if (isDuplicate) {
        showWordFeedback(`"${word}" has already been used!`, 'error');
        return;
      }

      // Disable input while submitting
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>';

      try {
        if (isSolo) {
          // Solo mode: add word locally
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

          // Update player score
          const currentScores = getSoloScores();
          currentScores.player += points;
          updateSoloScoreboard(currentScores);

          // Stop timer, bot's turn
          stopTimer();
          currentLetter = getLastLetter(word);
          showTimer(false);
          botPlay(currentLetter);
        } else {
          // Multiplayer: submit to Supabase
          const data = await submitWord(currentGameId, word);
          input.value = '';
          feedback.classList.add('hidden');
          showToast('success', `"${word}" submitted! +${data.points || word.length - 2} pts`);
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
      if (confirm('Leave this game?')) {
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
      board.innerHTML = '<p class="font-body-md text-body-md text-outline text-center py-4">No players yet.</p>';
      return;
    }

    // Sort by score descending
    const sorted = [...members].sort((a, b) => (b.score || 0) - (a.score || 0));

    board.innerHTML = sorted.map((m, i) => {
      const p = m.profiles || {};
      const avatarUrl = `https://api.dicebear.com/8.x/adventurer/svg?seed=${p.avatar_seed || m.player_id}`;
      const isMe = m.player_id === myUserId;
      const isCurrent = m.player_id === group?.current_turn_player_id;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';

      return `
        <div class="flex items-center justify-between p-gap-md bg-surface-container rounded-xl ${isMe ? 'ring-2 ring-primary/30' : ''} ${isCurrent ? 'animate-pulse-border' : ''}">
          <div class="flex items-center gap-gap-md min-w-0">
            <span class="font-headline-sm text-headline-sm text-outline w-5 flex-shrink-0">${medal || (i + 1)}</span>
            <img src="${avatarUrl}" alt="" class="w-9 h-9 rounded-full bg-surface-container-highest flex-shrink-0" />
            <div class="min-w-0">
              <p class="font-headline-sm text-headline-sm truncate">${p.display_name || 'Player ' + (i + 1)} ${isMe ? '(You)' : ''}</p>
              <p class="font-label-caps text-label-caps text-outline">${isCurrent ? '🔵 Playing...' : ''}</p>
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

    // Show newest first (already sorted)
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
              ${isLast ? '<span class="px-2 py-0.5 bg-primary text-on-primary text-[10px] font-bold uppercase rounded-full">NEW</span>' : ''}
            </div>
            <p class="font-label-caps text-label-caps text-outline">
              ${w.player_name || w.profiles?.display_name || 'Player'} · +${w.points || 0} pts
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

    // Add word lookup handlers
    list.querySelectorAll('.lookup-word').forEach(btn => {
      btn.addEventListener('click', () => {
        openDictionary(btn.dataset.word);
      });
    });

    // Scroll to top (newest word)
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
      turnText.textContent = '⏸️ Game paused';
      return;
    }

    if (isMyTurn) {
      turnText.textContent = '🎯 Your turn! Type a word!';
    } else {
      const currentPlayer = group?.members?.find(m => m.player_id === group?.current_turn_player_id);
      const name = currentPlayer?.profiles?.display_name || 'Other player';
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

        // Warning colors
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
      // In solo mode, timeout means bot's turn or game pause
      showToast('error', 'Time\'s up!');
      isMyTurn = false;
      hideWordInput();
      showTimer(false);
      updateTurnIndicator();
      disableGameControls();
      gameActive = false;
    } else {
      // In multiplayer, skip turn to next player
      showToast('error', 'Time\'s up! Skipping to next player...');
      isMyTurn = false;
      hideWordInput();
      showTimer(false);
      updateTurnIndicator();
      // Advance turn on the server — Realtime or polling will update the UI
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

  // formatTimeAgo now imported from utils/ui.js

  function cleanup() {
    stopTimer();
    if (botTimer) clearTimeout(botTimer);
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    store.set('currentGroup', null);
  }

  // Return cleanup function
  return () => {
    cleanup();
  };
}
