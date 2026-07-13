import { getCachedDefinition, cacheDefinition } from '../supabase.js';

/**
 * Fetch word definition from Free Dictionary API with caching
 */
export async function fetchDefinition(word) {
  const normalizedWord = word.toLowerCase().trim();

  // 1. Check Supabase cache first
  try {
    const cached = await getCachedDefinition(normalizedWord);
    if (cached) {
      return cached;
    }
  } catch (e) {
    // Ignore cache errors, fall through to API
  }

  // 2. Try Free Dictionary API
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalizedWord)}`
    );

    if (response.ok) {
      const data = await response.json();
      const result = data[0];

      // Parse into a clean format
      const parsed = {
        word: result.word,
        phonetic: result.phonetic || result.phonetics?.[0]?.text || '',
        audio: result.phonetics?.find(p => p.audio)?.audio || '',
        meanings: result.meanings.map(m => ({
          partOfSpeech: m.partOfSpeech,
          definitions: m.definitions.slice(0, 3).map(d => ({
            definition: d.definition,
            example: d.example || '',
            synonyms: d.synonyms?.slice(0, 5) || [],
          })),
        })),
        sourceUrls: result.sourceUrls || [],
      };

      // Cache asynchronously (don't await)
      cacheDefinition(normalizedWord, parsed).catch(() => {});

      return parsed;
    }

    if (response.status === 404) {
      // 3. Try Wiktionary as fallback
      return await fetchWiktionary(normalizedWord);
    }

    throw new Error(`Dictionary API returned ${response.status}`);
  } catch (error) {
    // 4. Last resort: try Wiktionary
    try {
      return await fetchWiktionary(normalizedWord);
    } catch {
      throw new Error(`Could not find definition for "${word}". Check spelling or try another word.`);
    }
  }
}

/**
 * Fallback: Fetch from Wiktionary REST API
 */
async function fetchWiktionary(word) {
  const response = await fetch(
    `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`
  );

  if (!response.ok) {
    throw new Error('Not found in Wiktionary');
  }

  const data = await response.json();
  const meanings = [];

  for (const [lang, entries] of Object.entries(data)) {
    if (lang !== 'en') continue;
    for (const entry of entries) {
      meanings.push({
        partOfSpeech: entry.partOfSpeech || 'unknown',
        definitions: (entry.definitions || []).slice(0, 3).map(d => ({
          definition: d.definition?.replace(/<[^>]+>/g, '') || '',
          example: '',
          synonyms: [],
        })),
      });
    }
  }

  const parsed = {
    word,
    phonetic: '',
    audio: '',
    meanings,
    sourceUrls: [`https://en.wiktionary.org/wiki/${word}`],
  };

  // Cache asynchronously
  cacheDefinition(normalizedWord, parsed).catch(() => {});

  return parsed;
}
