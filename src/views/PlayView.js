import store from '../store.js';
import { navigate } from '../router.js';
import { supabase, getCurrentUser, getProfile, subscribeToGame, submitWord, getGameWords, skipTurn, endGame, deadModeEliminate, leaveGame } from '../supabase.js';
import { showToast } from '../utils/ui.js';
import { openDictionary } from '../components/DictionaryModal.js';
import { isValidWord, getWordsStartingWith, checkChainRule, getLastLetter, calculateScore, hasProfanity } from '../utils/words.js';
import { validateWord, checkWinner } from '../gameLogic.js';

let turnTimer = null;
let secondsLeft = 0;

const MODE_LABELS = {
  turns_timed: { label: 'Timed', icon: 'timer', desc: 'Take turns with a timer' },
  turns_relaxed: { label: 'Relaxed', icon: 'self_improvement', desc: 'No time pressure' },
  free_for_all: { label: 'Open', icon: 'diversity_3', desc: 'Anyone can submit' },
};

/**
 * PlayView - The game arena
 */
export default async function PlayView(container, params) {
  const gameId = params.id;
  const isSolo = gameId === 'solo';

  container.innerHTML = `
    <div class="flex flex-col gap-4 pb-28 animate-fade-in-up">
      <!-- Loading -->
      <div id="play-loading" class="flex flex-col items-center justify-center py-20">
        <div class="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-body-md text-dark-text-muted">Loading game...</p>
      </div>

      <!-- Game content (hidden until loaded) -->
      <div id="play-content" class="hidden space-y-4">
        <!-- Scoreboard -->
        <div id="scoreboard" class="glass-card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-heading text-heading-sm text-dark-text flex items-center gap-2">
              <span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL'1">leaderboard</span>
              Scoreboard
            </h3>
            <span id="mode-badge" class="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-label-sm"></span>
          </div>
          <div id="scoreboard-list" class="space-y-1.5">
            <!-- Rendered by JS -->
          </div>
        </div>

        <!-- Combat banner (combat mode only) -->
        <div id="combat-banner" class="hidden glass-card p-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-warning" style="font-variation-settings:'FILL'1">diamond</span>
            <span class="font-heading text-heading-sm text-dark-text">Combat</span>
            <span class="text-label-sm text-dark-text-muted">wager <span id="combat-wager">0</span> 💎</span>
          </div>
          <div class="text-label-sm text-dark-text-muted">
            Your gems: <span id="combat-balance" class="text-warning font-bold">0</span> 💎
          </div>
        </div>

        <!-- Turn Indicator -->
        <div id="turn-indicator" class="glass-card p-5 text-center">
          <div class="flex items-center justify-center gap-4 mb-3">
            <div class="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
              <span id="required-letter" class="font-heading text-heading-lg font-extrabold text-primary letter-pulse">A</span>
            </div>
          </div>
          <p id="turn-text" class="font-heading text-heading-sm text-dark-text">Your turn!</p>
          <p class="text-body-sm text-dark-text-muted mt-1">Enter a word starting with <span id="turn-letter" class="text-primary font-bold"></span></p>
        </div>

        <!-- Timer -->
        <div id="timer-container" class="hidden">
          <div class="flex items-center justify-between mb-1.5">
            <span id="timer-label" class="text-label-sm text-dark-text-muted">Time remaining</span>
            <span id="timer-display" class="font-heading text-heading-sm text-dark-text font-bold">60s</span>
          </div>
          <div class="progress-bar">
            <div id="timer-bar" class="progress-bar-fill bg-primary" style="width: 100%"></div>
          </div>
        </div>

        <!-- Word Input -->
        <div id="word-input-area" class="glass-card p-4 space-y-3">
          <div class="flex items-center gap-2">
            <span id="input-prefix" class="font-heading text-heading-sm text-primary font-bold uppercase"></span>
            <input id="word-input" type="text" maxlength="20" autocomplete="off"
              class="flex-1 bg-transparent border-none outline-none text-heading-md font-heading font-bold text-dark-text uppercase placeholder-dark-text-muted/30" placeholder="Type a word..." />
          </div>
          <div class="flex gap-2">
            <button id="submit-word-btn" class="flex-1 py-3.5 btn-primary text-body-md flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-lg">check</span>
              Submit
            </button>
            <button id="dictionary-btn" class="px-4 py-3.5 rounded-xl btn-secondary text-body-sm" title="Look up dictionary">
              <span class="material-symbols-outlined">menu_book</span>
            </button>
          </div>
          <p id="word-feedback" class="text-body-sm text-dark-text-muted text-center min-h-[1.5rem]"></p>
        </div>

        <!-- Word Chain -->
        <div class="glass-card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-heading text-heading-sm text-dark-text flex items-center gap-2">
              <span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL'1">link</span>
              Word Chain
            </h3>
            <span id="chain-count" class="text-label-sm text-dark-text-muted">0 words</span>
          </div>
          <div id="chain-list" class="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            <p class="text-body-sm text-dark-text-muted text-center py-8">No words yet. Start the chain!</p>
          </div>
        </div>

        <!-- Leave button -->
        <button id="leave-game-btn" class="w-full py-3 text-body-sm text-dark-text-muted hover:text-error transition-colors">
          Leave Game
        </button>
      </div>
    </div>
  `;

  let currentGameId = null;
  let myUserId = null;
  let myProfile = null;
  let group = null;
  let words = [];
  let isMyTurn = false;
  let unsubscribe = null;
  let cleanupPoll = null;
  let gameActive = false;
  let currentLetter = null;
  let botTimer = null;
  let rules = {};
  let gameMode = 'turns_timed';

  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    myUserId = user.id;
    myProfile = store.get('profile');

    if (isSolo) {
      initSoloMode();
    } else {
      await initMultiplayerMode();
    }

    container.querySelector('#play-loading').classList.add('hidden');
    container.querySelector('#play-content').classList.remove('hidden');

  } catch (error) {
    container.querySelector('#play-loading').innerHTML = `
      <div class="w-16 h-16 rounded-2xl bg-error-container flex items-center justify-center mx-auto mb-4">
        <span class="material-symbols-outlined text-3xl text-error">error</span>
      </div>
      <p class="text-body-md text-dark-text-muted">${error.message}</p>
      <button onclick="window.location.hash='#/'" class="mt-6 px-8 py-3.5 btn-primary text-body-md">Go Home</button>
    `;
  }

  // ====== SOLO MODE ======

  function initSoloMode() {
    gameActive = true;
    currentGameId = 'solo';
    gameMode = 'turns_timed';

    group = {
      id: 'solo',
      name: 'Solo Practice',
      code: 'solo',
      status: 'active',
      game_mode: 'turns_timed',
      current_letter: null,
      current_turn_player_id: 'player',
      members: [
        { player_id: 'player', profiles: { display_name: 'You', avatar_url: null }, turn_position: 1, score: 0 },
        { player_id: 'bot', profiles: { display_name: 'WordBot', avatar_url: null }, turn_position: 2, score: 0 },
      ],
    };
    words = [];
    isMyTurn = true;
    currentLetter = null;

    updateSoloScoreboard();
    updateTurnIndicator();
    renderChain();
    enableGameControls();
  }

  function updateSoloScoreboard() {
    const board = container.querySelector('#scoreboard-list');
    const playerScore = (words.filter(w => w.player_id === 'player').reduce((s, w) => s + (w.points || 0), 0));
    const botScore = (words.filter(w => w.player_id === 'bot').reduce((s, w) => s + (w.points || 0), 0));

    board.innerHTML = `
      <div class="flex items-center justify-between p-2.5 rounded-lg bg-glass ${isMyTurn ? 'border border-primary/20' : ''}">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-body-sm font-bold text-primary">YO</div>
          <span class="font-heading text-heading-sm text-dark-text">You</span>
        </div>
        <span class="font-heading text-heading-sm text-dark-text font-bold">${playerScore}</span>
      </div>
      <div class="flex items-center justify-between p-2.5 rounded-lg bg-glass ${!isMyTurn ? 'border border-accent/20' : ''}">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-body-sm font-bold text-accent">WB</div>
          <span class="font-heading text-heading-sm text-dark-text">WordBot</span>
        </div>
        <span class="font-heading text-heading-sm text-dark-text font-bold">${botScore}</span>
      </div>
    `;
  }

  function botPlay() {
    if (!gameActive) return;

    let botWord = null;
    const startLetter = currentLetter || 'A';

    // Find a valid word
    const usedWords = new Set(words.map(w => w.word.toLowerCase()));
    const candidates = getWordsStartingWith(startLetter);
    const available = candidates.filter(w => !usedWords.has(w.toLowerCase()));

    if (available.length > 0) {
      botWord = available[0];
    } else {
      // Fallback
      const fallback = ['ACE', 'ARC', 'ART', 'APE', 'ARE', 'AGE', 'AXE', 'ADD', 'ALL', 'AND',
        'BED', 'BIG', 'BOX', 'BUS', 'BAT', 'BAG', 'BALL', 'BAND', 'BANK', 'BELL',
        'CAR', 'CAT', 'CUP', 'CUT', 'CALL', 'CARD', 'CARE', 'CASE', 'CASH', 'CAST',
        'DAY', 'DIG', 'DOG', 'DOT', 'DARK', 'DASH', 'DATA', 'DATE', 'DAWN', 'DEAL',
        'EAT', 'EGG', 'END', 'EACH', 'EARN', 'EASE', 'EAST', 'EASY', 'EDGE', 'ELSE',
        'FAR', 'FIT', 'FUN', 'FACT', 'FALL', 'FAME', 'FARM', 'FAST', 'FEAR', 'FILE',
        'GAP', 'GET', 'GUN', 'GAME', 'GARDEN', 'GATE', 'GIFT', 'GIRL', 'GOAL', 'GOLD',
        'HAT', 'HIT', 'HOT', 'HALL', 'HAND', 'HARD', 'HARM', 'HATE', 'HAVE', 'HEAD',
        'ICE', 'INK', 'INN', 'ITEM', 'IDEA', 'IMAGE', 'INCH', 'INFO', 'IRON', 'ISLE',
        'JAM', 'JET', 'JOB', 'JAR', 'JAW', 'JAZZ', 'JEEP', 'JOKE', 'JUMP', 'JURY',
        'KEY', 'KID', 'KIT', 'KICK', 'KIND', 'KING', 'KISS', 'KNEE', 'KNIT', 'KNOB',
        'LAP', 'LEG', 'LIP', 'LAB', 'LADY', 'LAKE', 'LAND', 'LARK', 'LASH', 'LASS',
        'MAP', 'MAT', 'MIX', 'MAD', 'MAN', 'MAY', 'MENU', 'MILD', 'MILK', 'MIND',
        'NAP', 'NET', 'NUT', 'NAIL', 'NAME', 'NAVY', 'NEAR', 'NEAT', 'NECK', 'NEED',
        'OAK', 'OAR', 'OWL', 'OWN', 'ODOR', 'OIL', 'ONLY', 'OPEN', 'ORAL', 'OURS',
        'PAD', 'PAN', 'PEN', 'POT', 'PACK', 'PAGE', 'PAID', 'PAIN', 'PAIR', 'PALE', 'PALM',
        'RAD', 'RAG', 'RAM', 'RAN', 'RAP', 'RAT', 'RAW', 'RAY', 'RED', 'RIG', 'RIM', 'ROB', 'ROD', 'ROW', 'RUB', 'RUG', 'RUN', 'RUSH',
        'SAD', 'SAG', 'SAP', 'SAT', 'SAW', 'SAY', 'SET', 'SIT', 'SIX', 'SKI', 'SKY', 'SLAM', 'SLAP', 'SLIM', 'SLIP', 'SLOT', 'SLOW',
        'TAG', 'TAN', 'TAP', 'TEN', 'TIE', 'TIN', 'TIP', 'TOE', 'TON', 'TOP', 'TOW', 'TOY', 'TUB', 'TUG', 'TWO',
        'URN', 'USE', 'USED', 'USER', 'USUAL', 'UTTER',
        'VAN', 'VAT', 'VET', 'VOW', 'VAIN', 'VALE', 'VANE', 'VARY', 'VAST', 'VEIL', 'VEIN', 'VENT', 'VERB', 'VERY', 'VEST', 'VETO', 'VICE', 'VIEW', 'VINE', 'VOID',
        'WAD', 'WAG', 'WAR', 'WAX', 'WAY', 'WEB', 'WED', 'WET', 'WIG', 'WIN', 'WIT', 'WOE', 'WOK', 'WON', 'WOO', 'WOW',
        'YAK', 'YAM', 'YAP', 'YAW', 'YEA', 'YES', 'YET', 'YEW', 'YIN', 'YOU', 'YOUR',
        'ZAP', 'ZEN', 'ZIP', 'ZIT', 'ZOO', 'ZOOM',
        'BOOK', 'COOK', 'DOOR', 'FOOD', 'GOOD', 'HOOD', 'LOOK', 'MOON', 'NOON', 'ROOM', 'SOON', 'TOOK', 'WOOD', 'WOOL',
        'BEEN', 'DEEN', 'FEED', 'NEED', 'SEED', 'WEED',
        'BALL', 'CALL', 'FALL', 'HALL', 'MALL', 'TALL', 'WALL',
        'BELL', 'CELL', 'DELL', 'FELL', 'HELL', 'SELL', 'TELL', 'WELL',
        'BORN', 'CORN', 'HORN', 'LORN', 'TORN', 'WORN',
        'BURN', 'TURN',
        'BIRD', 'CORD', 'FORD', 'WORD',
        'CARD', 'HARD', 'YARD',
        'BAND', 'HAND', 'LAND', 'SAND',
        'BEND', 'LEND', 'SEND', 'TEND',
        'BOND', 'FOND', 'POND',
        'BARK', 'DARK', 'MARK', 'PARK',
        'BACK', 'PACK', 'RACK', 'SACK', 'TACK',
        'BEAK', 'LEAK', 'PEAK', 'WEAK',
        'BEAT', 'FEAT', 'HEAT', 'MEAT', 'NEAT', 'SEAT',
        'BELT', 'FELT', 'MELT',
        'BEST', 'NEST', 'REST', 'TEST', 'VEST', 'WEST',
        'BITE', 'KITE', 'MITE', 'NITE', 'SITE',
        'BLUE', 'CLUE', 'FLUE', 'GLUE', 'SLUE',
        'BOLD', 'COLD', 'FOLD', 'GOLD', 'HOLD', 'MOLD', 'SOLD', 'TOLD',
        'BOLT', 'COLT', 'MELT', 'BELT',
        'BOMB', 'COMB', 'TOMB',
        'BONE', 'CONE', 'GONE', 'LONE', 'TONE', 'ZONE',
        'BORE', 'CORE', 'MORE', 'PORE', 'SORE', 'TORE', 'WORE',
        'BORN', 'CORN', 'HORN', 'TORN', 'WORN',
        'BOSS', 'LOSS', 'MOSS', 'TOSS',
        'BOWL', 'COWL', 'HOWL', 'OWL',
        'BULB', 'CURB',
        'BULK', 'HULK', 'SILK',
        'BUMP', 'DUMP', 'JUMP', 'LUMP', 'PUMP',
        'BUNCH', 'LUNCH', 'MUNCH', 'PUNCH',
        'CAGE', 'PAGE', 'RAGE', 'SAGE', 'WAGE',
        'CAKE', 'BAKE', 'LAKE', 'MAKE', 'RAKE', 'TAKE', 'WAKE',
        'CAME', 'FAME', 'GAME', 'LAME', 'NAME', 'SAME', 'TAME',
        'CANE', 'LANE', 'MANE', 'VANE', 'WANE',
        'CARE', 'DARE', 'FARE', 'HARE', 'MARE', 'PARE', 'RARE', 'WARE',
        'CART', 'DART', 'FART', 'PART', 'TART',
        'CASE', 'BASE', 'EASE', 'VASE',
        'CASH', 'DASH', 'HASH', 'LASH', 'MASH', 'RASH', 'SASH',
        'CASK', 'MASK', 'TASK',
        'CAST', 'FAST', 'LAST', 'MAST', 'PAST', 'VAST',
        'CAVE', 'GAVE', 'HAVE', 'PAVE', 'RAVE', 'SAVE', 'WAVE',
        'CHAT', 'THAT', 'WHAT',
        'CHEF', 'THEIR',
        'CHIN', 'THIN', 'WHEN', 'WHIN',
        'CHIP', 'SHIP', 'WHIP',
        'CLAD', 'GLAD',
        'CLAN', 'PLAN', 'THAN',
        'CLAP', 'FLAP', 'SLAP',
        'CLAY', 'PLAY', 'SLAY',
        'CLIP', 'FLIP', 'SLIP',
        'CLUB', 'FLUB',
        'COAL', 'GOAL', 'SOAL',
        'COAT', 'GOAT', 'MOAT',
        'CODE', 'MODE', 'RODE',
        'COIL', 'FOIL', 'OIL', 'SOIL', 'TOIL',
        'COIN', 'JOIN', 'LOIN',
        'COLD', 'FOLD', 'GOLD', 'HOLD', 'MOLD', 'SOLD', 'TOLD',
        'COLT', 'BOLT', 'MELT',
        'COME', 'HOME', 'SOME',
        'COOK', 'BOOK', 'HOOK', 'LOOK', 'TOOK',
        'COOL', 'FOOL', 'POOL', 'TOOL', 'WOOL',
        'COOP', 'HOOP', 'LOOP',
        'COPE', 'HOPE', 'POPE', 'ROPE',
        'CORD', 'FORD', 'LORD', 'WORD',
        'CORE', 'BORE', 'GORE', 'MORE', 'PORE', 'SORE', 'TORE', 'WORE',
        'CORK', 'FORK', 'PORK', 'WORK',
        'CORN', 'BORN', 'HORN', 'TORN', 'WORN',
        'COST', 'LOST', 'MOST', 'POST',
        'COTE', 'NOTE', 'VOTE', 'WOTE',
        'COUCH', 'POUCH', 'TOUCH',
        'COULD', 'MOULD', 'WOULD',
        'COUNT', 'MOUNT',
        'COURT', 'FOURTH',
        'COVE', 'LOVE', 'MOVE', 'ROVE',
        'COWL', 'BOWL', 'HOWL',
        'CRAB', 'GRAB', 'SLAB',
        'CRACK', 'TRACK',
        'CRAFT', 'DRAFT', 'GRAFT', 'SHAFT',
        'CRAG', 'DRAG', 'FLAG', 'SNAG',
        'CRANE', 'MANE', 'LANE', 'CANE', 'PLANE',
        'CRANK', 'FRANK', 'PRANK', 'TRANK',
        'CRASH', 'TRASH',
        'CRATE', 'PLATE', 'SKATE', 'SLATE',
        'CRAVE', 'BRAVE', 'GRAVE', 'SHAVE', 'SLAVE',
        'CRAWL', 'BRAWL', 'DRAWL', 'SCRAWL',
        'CRAZY', 'LAZY',
        'CREAK', 'BREAK', 'FREAK', 'LEAK', 'PEAK', 'WEAK',
        'CREAM', 'DREAM', 'SCREAM', 'STREAM',
        'CREST', 'FEST', 'NEST', 'PEST', 'REST', 'TEST', 'VEST', 'WEST',
        'CRIB', 'BRIB',
        'CRIME', 'DIME', 'LIME', 'MIME', 'RIME', 'TIME',
        'CRISP', 'LISP',
        'CROAK', 'SOAK',
        'CROWD', 'BROWD',
        'CROWN', 'BROWN', 'DROWN', 'FROWN',
        'CRUDE', 'RUDE',
        'CRUEL', 'FUEL',
        'CRUMB', 'THUMB',
        'CRUSH', 'BRUSH', 'FLUSH', 'PLUSH', 'SLUSH',
        'CRUST', 'DUST', 'JUST', 'LUST', 'MUST', 'RUST',
        'CRYPT', 'SCRIPT',
        'CUBE', 'TUBE',
        'CULT', 'FULT',
        'CURB', 'URBAN',
        'CURD', 'TURD',
        'CURE', 'LURE', 'PURE', 'SURE',
        'CURL', 'FURL', 'HURL',
        'CURSE', 'NURSE', 'PURSE',
        'CURVE', 'NERVE',
        'CUSHION', 'RUSH',
        'CUSTODY', 'CUSTOM',
        'CYCLE', 'BICYCLE'];

      // Pick from fallback
      const fallbackAvailable = fallback.filter(w => w[0].toLowerCase() === startLetter.toLowerCase() && !usedWords.has(w.toLowerCase()));
      if (fallbackAvailable.length > 0) {
        botWord = fallbackAvailable[0];
      }
    }

    if (botWord) {
      const points = calculateScore(botWord);

      words.push({
        id: 'bot-' + Date.now(),
        word: botWord,
        word_lower: botWord.toLowerCase(),
        player_id: 'bot',
        points: points,
        created_at: new Date().toISOString(),
        is_bot: true,
        profiles: { display_name: 'WordBot' },
      });

      currentLetter = getLastLetter(botWord);
      isMyTurn = true;
      gameActive = true;

      updateSoloScoreboard();
      updateTurnIndicator();
      renderChain();
      enableGameControls();
      showWordFeedback(`WordBot played "${botWord}" (+${points})`);
    } else {
      // Bot couldn't find a word, player wins!
      showWordFeedback('WordBot couldn\'t find a word! You win! 🎉');
      gameActive = false;
      disableGameControls();
    }
  }

  function setupNewSoloGame() {
    words = [];
    currentLetter = null;
    isMyTurn = true;
    gameActive = true;
    updateSoloScoreboard();
    updateTurnIndicator();
    renderChain();
    enableGameControls();
  }

  // ====== MULTIPLAYER MODE ======

  async function initMultiplayerMode() {
    const { getGroupWithMembers } = await import('../supabase.js');
    group = await getGroupWithMembers(gameId);

    if (!group) throw new Error('Game not found');

    currentGameId = group.id;
    gameMode = group.game_mode || 'turns_timed';
    gameActive = group.status === 'active';
    currentLetter = group.current_letter || null;

    // Parse host-configured rules into a structured object
    const csv = (s) => (s ? String(s).split(',').map(x => x.trim().toLowerCase()).filter(Boolean) : []);
    rules = {
      winScore: group.win_score || 0,
      deadMode: !!group.dead_mode,
      bannedVowels: csv(group.banned_vowels),
      minLength: group.min_length || 2,
      bannedSuffixes: csv(group.banned_suffixes),
      allowedPos: csv(group.allowed_pos),
      combatMode: !!group.combat_mode,
      gemWager: group.gem_wager || 0,
    };

    // Set mode badge
    const modeBadge = container.querySelector('#mode-badge');
    const modeInfo = MODE_LABELS[gameMode] || MODE_LABELS.turns_timed;
    modeBadge.textContent = modeInfo.label;

    // Combat banner (combat mode only)
    if (rules.combatMode) {
      const combatBanner = container.querySelector('#combat-banner');
      const combatWager = container.querySelector('#combat-wager');
      const combatBalance = container.querySelector('#combat-balance');
      if (combatBanner) combatBanner.classList.remove('hidden');
      if (combatWager) combatWager.textContent = rules.gemWager || 0;
      if (combatBalance) combatBalance.textContent = myProfile?.gems || 0;
    }

    // Load words
    words = await getGameWords(gameId);

    // Check if it's my turn
    checkTurn();

    // Render initial state
    renderScoreboard();
    updateTurnIndicator();
    renderChain();

    if (isMyTurn) {
      enableGameControls();
      if (gameMode === 'turns_timed') startTurnTimer();
    }

    // Initial authoritative sync (handles the case where it's already our turn)

    // Subscribe to realtime
    unsubscribe = await subscribeToGame(gameId, {
      onWordInserted: (newWord) => {
        // Fetch full word data with profile
        getGameWords(gameId).then(allWords => {
          words = allWords;
          renderChain();
          renderScoreboard();
          syncTurnState();
        });
      },
      onGroupUpdated: (updatedGroup) => {
        if (updatedGroup.status === 'finished') {
          gameActive = false;
          disableGameControls();
          stopTimer();
          renderScoreboard();
          updateTurnIndicator();
          // Show combat gem delta if applicable
          if (rules.combatMode) {
            showCombatResult();
          } else {
            showWordFeedback('Game ended!');
          }
          return;
        }
        if (updatedGroup.current_letter) {
          currentLetter = updatedGroup.current_letter;
        }
        if (updatedGroup.current_turn_player_id) {
          group.current_turn_player_id = updatedGroup.current_turn_player_id;
        }
        // Always re-sync UI from authoritative DB state
        syncTurnState();
      },
      onMembersChanged: async () => {
        const { getGroupWithMembers } = await import('../supabase.js');
        const updated = await getGroupWithMembers(gameId);
        group.members = updated.members;
        renderScoreboard();
        syncTurnState();
      },
      onStatus: (status) => {
        if (status === 'SUBSCRIBED') {
          store.set('connectionStatus', 'connected');
        }
      }
    });

    // Poll fallback: self-heal if a realtime event is missed/delayed.
    // This guarantees the turn eventually reaches the correct player even if
    // the realtime 'groups' UPDATE event is dropped.
    const turnPoll = setInterval(async () => {
      if (!gameActive) return;
      try {
        const { getGroupWithMembers } = await import('../supabase.js');
        const fresh = await getGroupWithMembers(gameId);
        if (fresh?.current_turn_player_id && fresh.current_turn_player_id !== group.current_turn_player_id) {
          group.current_turn_player_id = fresh.current_turn_player_id;
          if (fresh.current_letter) currentLetter = fresh.current_letter;
          syncTurnState();
        }
      } catch (e) { /* ignore transient poll errors */ }
    }, 4000);

    // Store poll handle for cleanup
    cleanupPoll = turnPoll;
  }

  function checkTurn() {
    if (!gameActive && gameMode !== 'turns_relaxed') {
      isMyTurn = false;
      return;
    }
    if (gameMode === 'free_for_all') {
      isMyTurn = true;
      return;
    }
    isMyTurn = group.current_turn_player_id === myUserId;
  }

  // Authoritative turn sync: recompute whose turn it is from DB state and
  // update controls, timer, scoreboard, and turn indicator consistently.
  function syncTurnState() {
    checkTurn();
    renderScoreboard();
    updateTurnIndicator();
    if (isMyTurn) {
      enableGameControls();
      if (gameMode === 'turns_timed' && gameActive) startTurnTimer();
    } else {
      disableGameControls();
      stopTimer();
    }
  }

  // ====== SHARED ======

  function setupWordInput() {
    const input = container.querySelector('#word-input');
    const submitBtn = container.querySelector('#submit-word-btn');
    const feedback = container.querySelector('#word-feedback');
    const prefix = container.querySelector('#input-prefix');

    if (!input || !submitBtn) return;

    // Clear prefix for first word
    if (!currentLetter) {
      prefix.textContent = '';
      input.placeholder = 'Type any word to start...';
    } else {
      prefix.textContent = currentLetter.toUpperCase();
      input.placeholder = 'Type a word...';
    }

    submitBtn.onclick = async () => {
      const word = input.value.trim().toUpperCase();
      if (!word) {
        showWordFeedback('Please enter a word.');
        return;
      }

      // Validate
      if (word.length < 2) {
        showWordFeedback('Word must be at least 2 letters.');
        return;
      }

      const wordLower = word.toLowerCase();

      // Validate against chain + host rules (pure, no DB needed)
      const usedWords = words.map(w => w.word_lower);
      const validation = validateWord({
        word,
        requiredLetter: currentLetter,
        usedWords,
        rules,
        isWordValid: isValidWord,
        hasProfanity,
      });
      if (!validation.ok) {
        showWordFeedback(validation.reason);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>';

      try {
        if (isSolo) {
          const points = calculateScore(word);
          words.push({
            id: 'player-' + Date.now(),
            word,
            word_lower: wordLower,
            player_id: 'player',
            points,
            created_at: new Date().toISOString(),
            profiles: { display_name: 'You' },
          });

          currentLetter = getLastLetter(word);
          isMyTurn = false;
          gameActive = true;

          updateSoloScoreboard();
          updateTurnIndicator();
          renderChain();
          showWordFeedback(`"${word}" +${points} points!`);
          input.value = '';

          // Bot's turn
          disableGameControls();
          setTimeout(() => {
            botPlay();
          }, 1500);

        } else {
          await submitWord(currentGameId, word);
          input.value = '';
          showWordFeedback('Word submitted!');
          disableGameControls();
          stopTimer();

          // Check win condition (first to N points)
          if (rules.winScore > 0) {
            const fresh = await getGameWords(currentGameId);
            const memberScores = group.members.map(m => ({
              player_id: m.player_id,
              score: fresh.filter(w => w.player_id === m.player_id)
                .reduce((s, w) => s + (w.points || 0), 0),
            }));
            if (checkWinner(memberScores, rules.winScore)) {
              await endGame(currentGameId).catch(() => {});
            }
          }
        }
      } catch (error) {
        showWordFeedback(error.message);
      }

      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span class="material-symbols-outlined text-lg">check</span> Submit`;
    };

    // Enter key
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        submitBtn.click();
      }
    };
  }

  function setupLeaveButton() {
    container.querySelector('#leave-game-btn').addEventListener('click', async () => {
      if (confirm('Leave this game?')) {
        if (!isSolo && currentGameId) {
          // Best-effort: free the turn / end the game if needed. Fire-and-forget
          // because the user is navigating away regardless.
          try { await leaveGame(currentGameId); } catch (e) { /* ignore */ }
        }
        if (unsubscribe) unsubscribe();
        navigate('/');
      }
    });
  }

  function setupDictionaryButton() {
    container.querySelector('#dictionary-btn').addEventListener('click', () => {
      const input = container.querySelector('#word-input');
      const word = input.value.trim();
      if (word) {
        openDictionary(word);
      } else {
        showToast('info', 'Type a word first, then tap the dictionary icon.');
      }
    });
  }

  function renderScoreboard() {
    const board = container.querySelector('#scoreboard-list');
    if (!group?.members) return;

    const sorted = [...group.members].sort((a, b) => (b.score || 0) - (a.score || 0));

    board.innerHTML = sorted.map((m, i) => {
      const p = m.profiles || {};
      const isMe = m.player_id === myUserId;
      const isCurrent = m.player_id === group.current_turn_player_id;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';

      return `
        <div class="flex items-center justify-between p-2.5 rounded-lg ${isMe ? 'bg-primary/10' : 'bg-glass'} ${isCurrent && !isSolo ? 'border border-primary/20' : ''} transition-all">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-body-sm font-bold text-primary overflow-hidden">
              ${p.avatar_url
                ? `<img src="${p.avatar_url}" alt="" class="w-full h-full object-cover" />`
                : (p.display_name || '?').slice(0, 2).toUpperCase()
              }
            </div>
            <div>
              <span class="font-heading text-heading-sm text-dark-text">${p.display_name || 'Player'}</span>
              ${isMe ? '<span class="text-label-sm text-dark-text-muted ml-1">(you)</span>' : ''}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-heading text-heading-sm text-dark-text font-bold">${m.score || 0}</span>
            <span class="text-label-sm text-dark-text-muted">pts</span>
            ${medal ? `<span class="text-sm">${medal}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function getSoloScores() {
    const playerScore = words.filter(w => w.player_id === 'player').reduce((s, w) => s + (w.points || 0), 0);
    const botScore = words.filter(w => w.player_id === 'bot').reduce((s, w) => s + (w.points || 0), 0);
    return { player: playerScore, bot: botScore };
  }

  function addWordToChain() {}

  function renderChain() {
    const list = container.querySelector('#chain-list');
    const empty = container.querySelector('#chain-list p');

    if (words.length === 0) {
      list.innerHTML = '<p class="text-body-sm text-dark-text-muted text-center py-8">No words yet. Start the chain!</p>';
      return;
    }

    list.innerHTML = words.slice().reverse().map((w, i) => {
      const isLast = i === 0;
      const nextWord = !isLast ? words[words.length - i] : null;
      const startLetter = nextWord ? nextWord.word[0].toUpperCase() : (currentLetter || '').toUpperCase();
      const isBot = w.is_bot || w.player_id === 'bot';
      const isMessage = w.is_message;

      if (isMessage) {
        return `<div class="text-center text-body-sm text-dark-text-muted py-2 italic">${w.word}</div>`;
      }

      const playerName = w.profiles?.display_name || (isBot ? 'WordBot' : 'Player');

      return `
        <div class="flex items-center gap-3 p-2.5 rounded-xl ${isBot ? 'bg-accent/5' : 'bg-glass'} glass-hover cursor-pointer group" onclick="window.__openDict && window.__openDict('${w.word}')">
          <div class="w-4 h-4 rounded-full ${isBot ? 'bg-accent/20' : 'bg-primary/20'} flex items-center justify-center">
            <div class="w-2 h-2 rounded-full ${isBot ? 'bg-accent' : 'bg-primary'}"></div>
          </div>
          <div class="flex-1 flex items-center justify-between">
            <div>
              <span class="font-heading text-heading-sm font-bold ${isBot ? 'text-accent' : 'text-dark-text'}">${w.word}</span>
              <span class="text-label-sm text-dark-text-muted ml-2">${playerName}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-label-sm text-dark-text-muted">+${w.points || 0}</span>
              <span class="material-symbols-outlined text-sm text-dark-text-muted opacity-0 group-hover:opacity-100 transition-all">menu_book</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    updateChainCount();
    updateTurnIndicator();

    // Wire up dictionary
    window.__openDict = (word) => {
      openDictionary(word);
    };
  }

  function updateChainCount() {
    const count = container.querySelector('#chain-count');
    if (count) count.textContent = `${words.length} word${words.length !== 1 ? 's' : ''}`;
  }

  function updateTurnIndicator() {
    const turnText = container.querySelector('#turn-text');
    const letterDisplay = container.querySelector('#required-letter');
    const turnLetter = container.querySelector('#turn-letter');

    if (!turnText) return;

    const requiredLetter = currentLetter || 'ANY';

    if (letterDisplay) letterDisplay.textContent = requiredLetter === 'ANY' ? '?' : requiredLetter.toUpperCase();
    if (turnLetter) turnLetter.textContent = requiredLetter === 'ANY' ? 'any letter' : `"${requiredLetter.toUpperCase()}"`;

    if (isSolo) {
      if (isMyTurn && gameActive) {
        turnText.textContent = 'Your turn!';
        turnText.className = 'font-heading text-heading-sm text-primary';
      } else if (!gameActive) {
        turnText.textContent = 'Game Over';
        turnText.className = 'font-heading text-heading-sm text-dark-text-muted';
      } else {
        turnText.textContent = 'WordBot is thinking...';
        turnText.className = 'font-heading text-heading-sm text-accent';
      }
    } else {
      if (isMyTurn && gameActive) {
        turnText.textContent = 'Your turn!';
        turnText.className = 'font-heading text-heading-sm text-primary';
      } else if (!gameActive) {
        turnText.textContent = 'Game ended';
        turnText.className = 'font-heading text-heading-sm text-dark-text-muted';
      } else {
        const currentPlayer = group.members?.find(m => m.player_id === group.current_turn_player_id);
        const name = currentPlayer?.profiles?.display_name || 'Another player';
        turnText.textContent = `${name}'s turn`;
        turnText.className = 'font-heading text-heading-sm text-dark-text-muted';
      }
    }

    // Update input prefix
    const prefix = container.querySelector('#input-prefix');
    if (prefix) {
      prefix.textContent = currentLetter ? currentLetter.toUpperCase() : '';
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

  function showTimer() {
    const timerContainer = container.querySelector('#timer-container');
    if (timerContainer) timerContainer.classList.remove('hidden');
  }

  function startTurnTimer() {
    if (gameMode !== 'turns_timed') return;
    showTimer();

    if (turnTimer) {
      clearInterval(turnTimer);
      turnTimer = null;
    }

    secondsLeft = group.turn_seconds || 60;
    const timerDisplay = container.querySelector('#timer-display');
    const timerBar = container.querySelector('#timer-bar');

    if (!timerDisplay || !timerBar) return;

    timerDisplay.textContent = `${secondsLeft}s`;
    timerBar.style.width = '100%';
    timerBar.className = 'progress-bar-fill bg-primary';

    turnTimer = setInterval(() => {
      secondsLeft--;
      const pct = (secondsLeft / (group.turn_seconds || 60)) * 100;
      timerDisplay.textContent = `${secondsLeft}s`;

      if (secondsLeft <= 10) {
        timerBar.className = 'progress-bar-fill bg-error';
      } else if (secondsLeft <= 20) {
        timerBar.className = 'progress-bar-fill bg-warning';
      }

      timerBar.style.width = `${Math.max(pct, 0)}%`;

      if (secondsLeft <= 0) {
        clearInterval(turnTimer);
        turnTimer = null;
        handleTimeOut();
      }
    }, 1000);
  }

  function stopTimer() {
    if (turnTimer) {
      clearInterval(turnTimer);
      turnTimer = null;
    }
    const timerContainer = container.querySelector('#timer-container');
    if (timerContainer) timerContainer.classList.add('hidden');
  }

  function handleTimeOut() {
    if (isSolo) {
      showWordFeedback('Time\'s up! Bot\'s turn.');
      disableGameControls();
      isMyTurn = false;
      setTimeout(() => botPlay(), 1000);
    } else {
      // Dead mode: timing out eliminates the player and ends the game
      if (rules.deadMode) {
        disableGameControls();
        deadModeEliminate(currentGameId, myUserId).catch(() => {});
        showWordFeedback('Time\'s up! You were eliminated.');
        return;
      }
      skipTurn(currentGameId).catch(() => {});
      showWordFeedback('Time\'s up! Turn skipped.');
      disableGameControls();
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
    if (input) {
      input.disabled = false;
      input.focus();
    }
    if (submitBtn) submitBtn.disabled = false;
  }

  function showWordFeedback(msg) {
    const feedback = container.querySelector('#word-feedback');
    if (feedback) feedback.textContent = msg;
  }

  // Show the player's gem delta after a combat game ends.
  async function showCombatResult() {
    try {
      const { getGameResults } = await import('../supabase.js');
      const results = await getGameResults(currentGameId);
      const mine = results.find(r => r.player_id === myUserId);
      if (mine && typeof mine.gems_delta === 'number' && mine.gems_delta !== 0) {
        const sign = mine.gems_delta > 0 ? '+' : '';
        showWordFeedback(`Game ended! You ${mine.gems_delta > 0 ? 'won' : 'lost'} ${sign}${mine.gems_delta} 💎`);
      } else {
        showWordFeedback('Game ended!');
      }
      // Refresh displayed balance from profile
      const combatBalance = container.querySelector('#combat-balance');
      if (combatBalance) combatBalance.textContent = store.get('profile')?.gems || 0;
    } catch (e) {
      showWordFeedback('Game ended!');
    }
  }

  // Setup
  if (!isSolo) {
    renderScoreboard();
  }
  setupWordInput();
  setupLeaveButton();
  setupDictionaryButton();

  // Cleanup
  return () => {
    if (turnTimer) {
      clearInterval(turnTimer);
      turnTimer = null;
    }
    if (botTimer) {
      clearInterval(botTimer);
      botTimer = null;
    }
    if (unsubscribe) {
      unsubscribe();
    }
    if (cleanupPoll) {
      clearInterval(cleanupPoll);
      cleanupPoll = null;
    }
  };
}