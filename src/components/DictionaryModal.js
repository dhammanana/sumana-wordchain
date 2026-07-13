import { fetchDefinition } from '../utils/dictionary.js';

let isOpen = false;

/**
 * Open the dictionary modal and fetch definition for a word
 */
export async function openDictionary(word) {
  if (isOpen) return;
  isOpen = true;

  const modal = document.getElementById('dictionary-modal');
  const content = document.getElementById('modal-content');
  const wordEl = document.getElementById('modal-word');
  const phoneticEl = document.getElementById('modal-phonetic');
  const definitionsEl = document.getElementById('modal-definitions');
  const closeBtn = document.getElementById('modal-close');

  // Set word and show loading
  wordEl.textContent = word.toUpperCase();
  phoneticEl.textContent = '';
  definitionsEl.innerHTML = `
    <div class="space-y-3">
      <div class="skeleton h-6 rounded-lg w-24"></div>
      <div class="skeleton h-16 rounded-lg"></div>
      <div class="skeleton h-16 rounded-lg"></div>
    </div>
  `;

  // Show modal
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
  }, 10);

  // Fetch definition
  try {
    const data = await fetchDefinition(word);

    if (data.phonetic) {
      phoneticEl.textContent = data.phonetic;
    }

    if (data.meanings && data.meanings.length > 0) {
      definitionsEl.innerHTML = data.meanings.map(meaning => `
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 bg-primary-container/20 text-primary text-xs font-bold uppercase rounded-full">
              ${meaning.partOfSpeech}
            </span>
          </div>
          <ul class="space-y-2">
            ${meaning.definitions.map((def, i) => `
              <li class="p-gap-md bg-surface-container rounded-lg">
                <p class="font-body-md text-on-background">${i + 1}. ${def.definition}</p>
                ${def.example ? `
                  <p class="font-body-md text-on-surface-variant italic mt-1 border-l-2 border-primary/30 pl-3">
                    "${def.example}"
                  </p>
                ` : ''}
                ${def.synonyms?.length > 0 ? `
                  <div class="flex flex-wrap gap-1 mt-2">
                    ${def.synonyms.slice(0, 3).map(s => `
                      <span class="text-xs bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded-full">${s}</span>
                    `).join('')}
                  </div>
                ` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('');
    } else {
      definitionsEl.innerHTML = `
        <div class="p-gap-md bg-surface-container rounded-lg text-center">
          <p class="font-body-md text-on-surface-variant">No definitions found for this word.</p>
        </div>
      `;
    }
  } catch (error) {
    definitionsEl.innerHTML = `
      <div class="p-gap-md bg-error-container/30 rounded-lg">
        <p class="font-body-md text-error">${error.message}</p>
        <p class="font-body-md text-on-surface-variant mt-2">The word may be misspelled or too obscure.</p>
      </div>
    `;
  }
}

/**
 * Close the dictionary modal
 */
export function closeDictionary() {
  if (!isOpen) return;
  isOpen = false;

  const modal = document.getElementById('dictionary-modal');
  const content = document.getElementById('modal-content');

  modal.classList.add('opacity-0');
  content.classList.add('scale-95');
  content.classList.remove('scale-100');

  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

// Set up close handlers immediately (module loads after DOM is ready with deferred scripts)
const modalEl = document.getElementById('dictionary-modal');
const closeBtnEl = document.getElementById('modal-close');

if (closeBtnEl) {
  closeBtnEl.addEventListener('click', closeDictionary);
}

if (modalEl) {
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeDictionary();
  });
}

// Close on Escape key (always active)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDictionary();
});
