/**
 * WordChain - Word validation and common word list
 *
 * This module provides:
 * - A curated list of ~1000 common English words covering all starting letters
 * - Client-side word validation
 * - Profanity filter
 * - Word list querying by starting letter
 */

// Curated list of common English words suitable for word chain game
// Source: derived from frequency-rank word lists, focused on 3-10 letter words
const COMMON_WORDS = [
  "apple", "ant", "always", "animal", "ask", "air", "art", "age", "area", "arm",
  "able", "about", "above", "accept", "across", "act", "add", "after", "again",
  "against", "agree", "allow", "almost", "along", "already", "also", "among",
  "amount", "and", "anger", "announce", "another", "answer", "any", "apart",
  "appear", "apply", "approach", "area", "argue", "arm", "arrange", "arrive",
  "article", "artist", "baby", "back", "bad", "bag", "ball", "band", "bank", "bar",
  "base", "basic", "battle", "beach", "bear", "beat", "beauty", "become", "before",
  "begin", "behave", "behind", "believe", "belong", "below", "beneath", "benefit",
  "best", "better", "between", "beyond", "bicycle", "big", "bill", "bird", "birth",
  "bit", "bite", "black", "blade", "blame", "blank", "blast", "blind", "block",
  "blood", "blow", "blue", "board", "boat", "body", "bomb", "bone", "book", "border",
  "born", "borrow", "boss", "both", "bother", "bottle", "bottom", "bound", "bowl",
  "box", "boy", "brain", "branch", "brave", "bread", "break", "breath", "brick",
  "bridge", "brief", "bright", "bring", "broad", "broken", "brown", "brush", "budget",
  "build", "bunch", "burden", "burn", "burst", "bus", "business", "busy", "butter",
  "button", "buy", "cabin", "cable", "cake", "call", "calm", "camera", "camp", "can",
  "cancel", "candle", "cap", "capital", "captain", "capture", "carbon", "card",
  "care", "career", "careful", "carry", "case", "cash", "cast", "castle", "cat",
  "catch", "cattle", "cause", "ceiling", "cell", "center", "century", "chain",
  "chair", "chamber", "champion", "chance", "change", "channel", "chapter", "charge",
  "chart", "cheap", "check", "cheese", "chemical", "chief", "child", "chip", "choice",
  "choose", "church", "circle", "citizen", "city", "civil", "claim", "class",
  "classic", "clean", "clear", "climb", "clock", "close", "cloth", "cloud", "club",
  "coach", "coast", "code", "coffee", "coin", "cold", "collapse", "collect", "college",
  "color", "column", "combine", "come", "comfort", "command", "comment", "commit",
  "common", "community", "company", "compare", "compete", "complex", "computer",
  "concern", "condition", "confirm", "congress", "connect", "consider", "contain",
  "content", "contest", "continue", "contract", "control", "convert", "cook",
  "cool", "copy", "core", "corner", "correct", "cost", "cotton", "count", "country",
  "county", "couple", "course", "court", "cousin", "cover", "crack", "craft", "crash",
  "crazy", "cream", "create", "credit", "crew", "crime", "crisis", "cross", "crowd",
  "crucial", "cultural", "culture", "cup", "current", "curve", "custom", "customer",
  "cut", "cycle", "daily", "damage", "dance", "danger", "dare", "dark", "data",
  "date", "daughter", "day", "dead", "deal", "dear", "death", "debate", "debt",
  "decade", "decide", "decision", "deck", "declare", "decline", "deep", "defeat",
  "defend", "define", "degree", "delay", "deliver", "demand", "deny", "depart",
  "depend", "deposit", "describe", "desert", "design", "desk", "detail", "detect",
  "develop", "device", "devote", "dialogue", "diamond", "diet", "differ", "dig",
  "dinner", "direct", "dirty", "discuss", "disease", "dish", "dismiss", "display",
  "distance", "distinct", "district", "divide", "doctor", "document", "dog", "dollar",
  "domain", "door", "double", "doubt", "down", "draft", "dragon", "drama", "draw",
  "dream", "dress", "drink", "drive", "drop", "drug", "dry", "dual", "during",
  "dust", "duty", "dynamic", "eager", "eagle", "early", "earn", "earth", "ease",
  "east", "eastern", "economy", "edge", "edition", "editor", "educate", "effect",
  "effort", "egg", "eight", "either", "elbow", "elder", "elect", "element", "elephant",
  "elite", "else", "emerge", "emotion", "emperor", "employ", "empty", "enable",
  "encounter", "end", "enemy", "energy", "engage", "engine", "enjoy", "enormous",
  "enough", "ensure", "enter", "entire", "entry", "envelope", "episode", "equal",
  "equipment", "era", "error", "escape", "essay", "estate", "even", "evening",
  "event", "ever", "every", "evidence", "evil", "exact", "examine", "example",
  "exchange", "excite", "excuse", "execute", "exercise", "exhibit", "exist", "expand",
  "expect", "expense", "expert", "explain", "explore", "export", "expose", "extend",
  "extra", "extreme", "eye", "fabric", "face", "fact", "factor", "factory", "fade",
  "fail", "fair", "faith", "fall", "false", "familiar", "family", "famous", "fan",
  "fancy", "fantasy", "far", "farm", "fashion", "fast", "fatal", "father", "fault",
  "favor", "fear", "feature", "federal", "feed", "feel", "fellow", "female", "fence",
  "festival", "fever", "field", "fierce", "fifteen", "fight", "figure", "file",
  "fill", "film", "final", "finance", "find", "fine", "finger", "finish", "fire",
  "firm", "first", "fish", "fit", "five", "fix", "flag", "flame", "flash", "flat",
  "flavor", "flee", "flesh", "flight", "flip", "float", "flood", "floor", "flow",
  "flower", "fly", "focus", "fold", "folk", "follow", "food", "foot", "force",
  "foreign", "forest", "forever", "forget", "form", "former", "fortune", "forward",
  "found", "foundation", "four", "frame", "free", "freedom", "freeze", "french",
  "frequency", "fresh", "friend", "front", "fruit", "fuel", "full", "fun", "function",
  "fund", "funny", "future", "gain", "galaxy", "gallery", "game", "gang", "gap",
  "garage", "garden", "gas", "gate", "gather", "gene", "general", "generate",
  "gentle", "genuine", "gesture", "ghost", "giant", "gift", "girl", "give", "glad",
  "glance", "glass", "global", "glove", "glow", "goal", "gold", "golden", "good",
  "govern", "grab", "grace", "grade", "grain", "grand", "grant", "grass", "grateful",
  "grave", "great", "green", "greet", "ground", "group", "grow", "growth", "guard",
  "guess", "guest", "guide", "guilt", "guitar", "gun", "gut", "guy", "habit",
  "hair", "half", "hall", "hand", "handle", "hang", "happen", "happy", "harbor",
  "hard", "harm", "hat", "hate", "haunt", "have", "head", "health", "hear", "heart",
  "heat", "heaven", "heavy", "height", "hello", "help", "here", "hero", "hide",
  "high", "highlight", "hill", "hint", "hip", "hire", "history", "hit", "hobby",
  "hold", "hole", "holiday", "home", "honest", "honor", "hook", "hope", "horizon",
  "horror", "horse", "hospital", "host", "hotel", "hour", "house", "huge", "human",
  "humor", "hundred", "hunt", "hurt", "husband", "ice", "idea", "identify", "ignore",
  "image", "imagine", "impact", "import", "impress", "improve", "include", "income",
  "increase", "indeed", "indicate", "industry", "infant", "inform", "initial",
  "injury", "inner", "input", "inquiry", "insect", "inside", "insist", "install",
  "instead", "interest", "internal", "internet", "interview", "into", "invest",
  "invite", "involve", "iron", "island", "isolate", "issue", "item", "itself",
  "jacket", "jail", "jam", "jar", "jazz", "jeans", "jet", "jewel", "job", "join",
  "joke", "journal", "journey", "joy", "judge", "juice", "jump", "junior", "jury",
  "just", "justice", "keen", "keep", "key", "kick", "kid", "kill", "kind", "king",
  "kiss", "kitchen", "knee", "knife", "knock", "know", "knowledge", "label", "labor",
  "lack", "lake", "land", "language", "large", "late", "latter", "laugh", "launch",
  "law", "lawyer", "layer", "lead", "leader", "leaf", "league", "lean", "learn",
  "least", "leather", "leave", "lecture", "left", "leg", "legal", "lemon", "length",
  "lesson", "letter", "level", "library", "license", "life", "lift", "light", "limit",
  "line", "link", "lion", "lip", "list", "listen", "literary", "little", "live",
  "load", "loan", "local", "lock", "log", "logic", "lonely", "long", "look", "lord",
  "lose", "loss", "lost", "lot", "loud", "love", "lovely", "low", "lower", "loyal",
  "luck", "lucky", "lunch", "lung", "machine", "mad", "magazine", "magic", "main",
  "maintain", "major", "make", "male", "manage", "manner", "many", "map", "march",
  "margin", "mark", "market", "marriage", "master", "match", "material", "matter",
  "mayor", "meal", "mean", "measure", "meat", "media", "medical", "medium", "meet",
  "member", "memory", "mental", "mention", "menu", "merchant", "mercy", "merely",
  "message", "metal", "method", "middle", "might", "mild", "mile", "military",
  "milk", "mind", "mine", "mineral", "minimum", "minister", "minor", "minute",
  "miracle", "mirror", "miss", "mission", "mistake", "mix", "model", "modern",
  "modest", "moment", "money", "monitor", "month", "moon", "moral", "more", "morning",
  "mother", "motion", "motor", "mountain", "mouse", "mouth", "move", "movie",
  "much", "murder", "muscle", "museum", "music", "musical", "mystery", "myth",
  "name", "narrow", "nation", "native", "natural", "nature", "near", "nearly",
  "neat", "necessary", "neck", "need", "needle", "negative", "neighbor", "neither",
  "nerve", "network", "neutral", "never", "new", "news", "next", "nice", "night",
  "nine", "noble", "noise", "none", "normal", "north", "northern", "nose", "note",
  "nothing", "notice", "notion", "novel", "now", "nuclear", "number", "nurse",
  "nut", "object", "observe", "obtain", "obvious", "occur", "ocean", "odd", "offer",
  "office", "officer", "official", "often", "oil", "old", "once", "only", "open",
  "operate", "opinion", "option", "orange", "orbit", "order", "ordinary", "organ",
  "origin", "original", "other", "outcome", "outside", "over", "overall", "owner",
  "oxygen", "pace", "pack", "package", "page", "pain", "paint", "pair", "palace",
  "pan", "panel", "panic", "paper", "parent", "park", "part", "partner", "party",
  "pass", "passage", "passenger", "passion", "past", "path", "patient", "pattern",
  "pause", "pay", "peace", "peak", "peer", "penalty", "people", "perfect", "perform",
  "perhaps", "period", "permit", "person", "pet", "phone", "photo", "phrase",
  "physical", "piano", "pick", "picture", "piece", "pilot", "pink", "pipe", "pitch",
  "place", "plain", "plan", "plane", "planet", "plant", "plastic", "plate", "play",
  "player", "please", "plenty", "pocket", "poem", "poet", "poetry", "point", "poison",
  "police", "policy", "polish", "polite", "poor", "popular", "port", "portion",
  "position", "positive", "possible", "post", "potato", "potential", "pound", "pour",
  "poverty", "power", "practice", "praise", "pray", "predict", "prefer", "prepare",
  "present", "president", "press", "pressure", "pretend", "pretty", "prevent",
  "previous", "price", "pride", "primary", "prince", "principle", "print", "prior",
  "prison", "private", "prize", "probably", "problem", "process", "produce", "product",
  "profit", "program", "project", "promise", "promote", "proof", "proper", "property",
  "protect", "protein", "protest", "proud", "prove", "provide", "public", "pull",
  "punch", "purchase", "pure", "purpose", "pursue", "push", "put", "puzzle",
  "qualify", "quality", "quarter", "queen", "question", "quick", "quiet", "quit",
  "quite", "quote", "race", "radical", "radio", "rain", "raise", "range", "rank",
  "rapid", "rare", "rate", "rather", "raw", "reach", "react", "read", "ready",
  "real", "reality", "realize", "really", "reason", "recall", "receive", "recent",
  "recipe", "record", "recover", "red", "reduce", "reflect", "reform", "refuse",
  "region", "regret", "reject", "relate", "relation", "relative", "relax", "release",
  "relief", "religion", "rely", "remain", "remark", "remember", "remind", "remote",
  "remove", "repeat", "replace", "report", "represent", "request", "require",
  "research", "resource", "respond", "rest", "restore", "result", "retain", "retire",
  "return", "reveal", "revenue", "reverse", "review", "revolution", "reward",
  "rhythm", "rich", "ride", "rifle", "right", "ring", "riot", "rise", "risk",
  "river", "road", "rock", "role", "roll", "romantic", "roof", "room", "root",
  "rope", "rough", "round", "route", "routine", "row", "royal", "ruin", "rule",
  "run", "rural", "rush", "sacred", "sacrifice", "sad", "safe", "safety", "sail",
  "sake", "salad", "salary", "sale", "salt", "same", "sample", "sand", "satellite",
  "satisfy", "save", "scale", "scene", "schedule", "school", "science", "score",
  "screen", "sea", "search", "season", "seat", "second", "secret", "section",
  "sector", "secure", "seed", "seek", "select", "self", "sell", "senate", "send",
  "senior", "sense", "sentence", "separate", "sequence", "series", "serious",
  "serve", "service", "session", "set", "settle", "seven", "several", "severe",
  "shade", "shadow", "shake", "shall", "shame", "shape", "share", "sharp", "shed",
  "sheet", "shelf", "shell", "shelter", "shift", "shine", "ship", "shirt", "shock",
  "shoe", "shoot", "shop", "shore", "short", "shot", "should", "shoulder", "shout",
  "show", "shower", "shut", "sick", "side", "sight", "sign", "signal", "silence",
  "silent", "silk", "silly", "silver", "similar", "simple", "since", "sing", "single",
  "sister", "site", "situation", "six", "size", "skill", "skin", "sky", "slave",
  "sleep", "slice", "slide", "slight", "slip", "slow", "small", "smart", "smell",
  "smile", "smoke", "smooth", "snake", "snow", "social", "soft", "soil", "solar",
  "soldier", "solid", "solution", "solve", "some", "son", "song", "soon", "sorry",
  "sort", "soul", "sound", "source", "south", "southern", "space", "speak", "special",
  "speech", "speed", "spend", "spin", "spirit", "split", "sport", "spot", "spread",
  "spring", "square", "stable", "staff", "stage", "stand", "standard", "star",
  "stare", "start", "state", "station", "status", "stay", "steady", "steal", "steel",
  "step", "stick", "still", "stock", "stomach", "stone", "stop", "store", "storm",
  "story", "straight", "strange", "strategy", "stream", "street", "strength", "stress",
  "stretch", "strict", "strike", "string", "strip", "strong", "structure", "struggle",
  "student", "studio", "study", "stuff", "style", "subject", "submit", "succeed",
  "success", "such", "sudden", "suffer", "sugar", "suggest", "suit", "summer",
  "sun", "super", "supper", "supply", "support", "suppose", "sure", "surface",
  "surgery", "surprise", "surround", "survey", "survive", "suspect", "sustain",
  "swallow", "swear", "sweep", "sweet", "swim", "swing", "switch", "symbol", "system",
  "table", "tail", "take", "tale", "talent", "talk", "tank", "tape", "target", "task",
  "taste", "tax", "teach", "teacher", "team", "tear", "technical", "technique",
  "technology", "teen", "teeth", "telephone", "temple", "tend", "tennis", "tension",
  "term", "test", "text", "thank", "theme", "theory", "thick", "thin", "thing",
  "think", "third", "thirty", "thought", "thousand", "thread", "threat", "three",
  "throat", "through", "throw", "thumb", "ticket", "tide", "tiger", "tight", "time",
  "tiny", "tip", "tire", "title", "today", "together", "tomorrow", "tone", "tongue",
  "tonight", "tool", "tooth", "top", "total", "touch", "tough", "tour", "toward",
  "tower", "town", "track", "trade", "tradition", "traffic", "train", "transfer",
  "transform", "travel", "treat", "treatment", "tree", "trend", "trial", "tribe",
  "trick", "trip", "troop", "trouble", "truck", "true", "truly", "trust", "truth",
  "try", "tube", "turn", "twelve", "twenty", "twice", "twin", "twist", "type",
  "typical", "ugly", "unable", "under", "understand", "union", "unique", "unit",
  "unite", "universe", "university", "unless", "unlike", "until", "unusual", "update",
  "upon", "upper", "urban", "urge", "use", "used", "useful", "usual", "valley",
  "value", "van", "variety", "vast", "vehicle", "venture", "version", "very",
  "vessel", "veteran", "victim", "victory", "video", "view", "village", "violence",
  "virtual", "virtue", "vision", "visit", "visual", "vital", "voice", "volume",
  "vote", "wage", "wait", "wake", "walk", "wall", "want", "war", "warm", "warn",
  "wash", "waste", "watch", "water", "wave", "way", "weak", "wealth", "weapon",
  "wear", "weather", "web", "wedding", "week", "weekend", "weight", "welcome",
  "welfare", "well", "west", "western", "wet", "whale", "wheel", "where", "whether",
  "which", "while", "whisper", "white", "whole", "whose", "wide", "widespread",
  "wife", "wild", "will", "win", "wind", "window", "wine", "wing", "winner",
  "winter", "wire", "wise", "wish", "with", "within", "without", "witness", "woman",
  "wonder", "wood", "wooden", "word", "work", "worker", "world", "worry", "worse",
  "worst", "worth", "would", "wound", "wrap", "write", "writer", "wrong", "yard",
  "year", "yellow", "yes", "yesterday", "yet", "yield", "young", "youth", "zebra",
  "zero", "zone"
];

// Build index by first letter for fast lookups
const WORDS_BY_LETTER = {};
for (const word of COMMON_WORDS) {
  const firstLetter = word[0];
  if (!WORDS_BY_LETTER[firstLetter]) WORDS_BY_LETTER[firstLetter] = [];
  WORDS_BY_LETTER[firstLetter].push(word);
}

// Build set for O(1) lookup
const WORD_SET = new Set(COMMON_WORDS);

/**
 * Check if a word is in the common word list
 */
export function isValidWord(word) {
  return WORD_SET.has(word.toLowerCase().trim());
}

/**
 * Get all words starting with a given letter
 */
export function getWordsStartingWith(letter) {
  return WORDS_BY_LETTER[letter.toLowerCase()] || [];
}

/**
 * Check if the last letter of a word matches the required next letter
 */
export function checkChainRule(word, requiredLetter) {
  if (!requiredLetter) return true; // First word, no rule
  return word.toLowerCase().startsWith(requiredLetter.toLowerCase());
}

/**
 * Get the last letter of a word
 */
export function getLastLetter(word) {
  return word[word.length - 1].toLowerCase();
}

/**
 * Lightweight profanity filter
 */
const PROFANITY_LIST = ['fuck', 'shit', 'damn', 'ass', 'bitch', 'bastard', 'crap',
  'dick', 'piss', 'slut', 'whore', 'cock', 'cunt', 'douche'];

export function hasProfanity(word) {
  const lower = word.toLowerCase();
  return PROFANITY_LIST.some(p => lower.includes(p));
}

/**
 * Score a word: length - 2 (minimum 1), +5 bonus if not in common list (verified word)
 */
export function calculateScore(word, isValidDictionaryWord) {
  const baseScore = Math.max(word.length - 2, 1);
  const bonus = isValidDictionaryWord ? 0 : 5; // Bonus for impressive vocabulary
  return baseScore + bonus;
}

/**
 * Generate a fun group name
 */
export function generateGroupName() {
  const adjectives = ['Vibrant', 'Clever', 'Swift', 'Brave', 'Calm', 'Eager', 'Fancy',
    'Grand', 'Happy', 'Jolly', 'Keen', 'Lively', 'Merry', 'Noble', 'Proud', 'Quick',
    'Sharp', 'Smart', 'Sunny', 'Witty', 'Bold', 'Cosmic', 'Daring', 'Epic'];
  const nouns = ['Tigers', 'Eagles', 'Falcons', 'Dolphins', 'Pandas', 'Koalas', 'Lions',
    'Phoenixes', 'Wolves', 'Hawks', 'Otters', 'Foxes', 'Bears', 'Deer', 'Owls',
    'Ravens', 'Swans', 'Herons', 'Cranes', 'Finches'];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
}
