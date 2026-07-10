/**
 * ui.js — all DOM rendering for the POC (spec §3, §5).
 *
 * Owns view switching, transcript rendering + karaoke highlighting, and the
 * non-modal chime panel. Deliberately dumb: it renders what app.js hands it
 * and reports user intent back through callbacks/promises. No fetching, no
 * TTS, no run state.
 */

/** Cached element references, populated by init(). */
const els = {};

/** <li> elements of the chapter currently playing (highlight targets). */
let currentChapterEls = [];

/** Cleanup handle for an open chime (timers + resolve), if any. */
let openChime = null;

/** Grab element references. Call once on load. */
export function init() {
  const byId = (id) => document.getElementById(id);
  els.setupView = byId('setup-view');
  els.playerView = byId('player-view');
  els.doneView = byId('done-view');
  els.setupForm = byId('setup-form');
  els.topicInput = byId('topic-input');
  els.apiKeyInput = byId('api-key-input');
  els.setupStatus = byId('setup-status');
  els.topicTitle = document.querySelector('[data-slot="topic-title"]');
  els.chapterProgress = document.querySelector('[data-slot="chapter-progress"]');
  els.transcript = byId('transcript');
  els.chimePanel = byId('chime-panel');
  els.chimePrompt = document.querySelector('[data-slot="chime-prompt"]');
  els.chimeOptions = byId('chime-options');
  els.chimeRedirectForm = byId('chime-redirect-form');
  els.chimeRedirectInput = byId('chime-redirect-input');
  els.chimeCountdown = document.querySelector('[data-slot="chime-countdown"]');
  els.skipBtn = byId('skip-btn');
  els.restartBtn = byId('restart-btn');
  els.fullTranscript = byId('full-transcript');
  els.confirmPanel = byId('confirm-panel');
  els.confirmPrompt = document.querySelector('[data-slot="confirm-prompt"]');
  els.confirmOptions = byId('confirm-options');
  els.confirmNoneBtn = byId('confirm-none-btn');
}

/**
 * Show exactly one view, hide the others.
 * @param {'setup'|'player'|'done'} name
 */
export function showView(name) {
  const views = { setup: els.setupView, player: els.playerView, done: els.doneView };
  for (const [key, el] of Object.entries(views)) {
    el.hidden = key !== name;
    el.classList.toggle('view--active', key === name);
  }
}

/**
 * Read the setup form.
 * @returns {{topic: string, depth: 'quick'|'deep', apiKey: string}}
 */
export function readSetup() {
  const depth = els.setupForm.querySelector('input[name="depth"]:checked')?.value ?? 'quick';
  return {
    topic: els.topicInput.value.trim(),
    depth: depth === 'deep' ? 'deep' : 'quick',
    apiKey: els.apiKeyInput.value.trim(),
  };
}

/** Pre-fill the API key field (from localStorage). */
export function setApiKey(value) {
  if (value) els.apiKeyInput.value = value;
}

/**
 * Write a status/progress message on the setup screen.
 * @param {string} message
 * @param {boolean} [isError]
 */
export function setStatus(message, isError = false) {
  els.setupStatus.textContent = message;
  els.setupStatus.classList.toggle('status--error', isError);
}

/**
 * Update the player topbar (topic title + chapter progress / generating note).
 * @param {string} topicTitle
 * @param {string} progressText  e.g. "Chapter 2 of 4" or "Generating chapter 2…"
 */
export function setChapterHeader(topicTitle, progressText) {
  els.topicTitle.textContent = topicTitle;
  els.chapterProgress.textContent = progressText;
}

/** Clear the transcript (new run). */
export function clearTranscript() {
  els.transcript.replaceChildren();
  currentChapterEls = [];
}

/** Build one transcript <li> for a dialogue line. */
function buildLineEl(line) {
  const li = document.createElement('li');
  li.className = `line line--host-${line.speaker.toLowerCase()}`;
  const speaker = document.createElement('span');
  speaker.className = 'line__speaker';
  speaker.textContent = line.speaker === 'A' ? 'Host A' : 'Host B';
  const text = document.createElement('span');
  text.className = 'line__text';
  text.textContent = line.text;
  li.append(speaker, text);
  return li;
}

/**
 * Append a chapter's dialogue lines to the transcript (un-highlighted).
 * They become the current highlight targets for highlightLine().
 * @param {import('./claude.js').DialogueLine[]} lines
 */
export function renderChapterLines(lines) {
  currentChapterEls = lines.map(buildLineEl);
  els.transcript.append(...currentChapterEls);
}

/**
 * Mark one line of the current chapter as active (karaoke effect).
 * @param {number} lineIndex Index within the current chapter's lines.
 */
export function highlightLine(lineIndex) {
  currentChapterEls.forEach((el, i) => el.classList.toggle('line--active', i === lineIndex));
  currentChapterEls[lineIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/**
 * Show the non-modal chime panel alongside the still-playing transcript
 * (spec §3's critical UX rule: never a modal, never pauses audio).
 * @param {import('./claude.js').Chime} chime
 * @param {number} autoContinueMs
 * @returns {Promise<string|null>} Chosen/typed steering text, or null on auto-continue.
 */
export function showChime(chime, autoContinueMs) {
  cancelChime(); // resolve any stale chime as no-steering before opening a new one

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      hideChime();
      resolve(value);
    };

    // Prompt + option buttons
    els.chimePrompt.textContent = chime.prompt;
    els.chimeOptions.replaceChildren(
      ...chime.options.map((option) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn';
        btn.textContent = option;
        btn.addEventListener('click', () => settle(option));
        li.append(btn);
        return li;
      })
    );

    // Free-text redirect
    const onSubmit = (e) => {
      e.preventDefault();
      const text = els.chimeRedirectInput.value.trim();
      if (text) settle(text);
    };
    els.chimeRedirectForm.addEventListener('submit', onSubmit);
    els.chimeRedirectInput.value = '';

    // Auto-continue countdown
    let remaining = Math.ceil(autoContinueMs / 1000);
    const renderCountdown = () => {
      els.chimeCountdown.textContent = `Otherwise we'll just carry on in ${remaining}s…`;
    };
    renderCountdown();
    const ticker = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) renderCountdown();
    }, 1000);
    const timeout = setTimeout(() => settle(null), autoContinueMs);

    openChime = {
      cancel: () => settle(null),
      cleanup: () => {
        clearInterval(ticker);
        clearTimeout(timeout);
        els.chimeRedirectForm.removeEventListener('submit', onSubmit);
      },
    };

    els.chimePanel.hidden = false;
  });
}

/** Hide the chime panel and tear down its listeners/timers. */
export function hideChime() {
  if (openChime) {
    openChime.cleanup();
    openChime = null;
  }
  els.chimePanel.hidden = true;
  els.chimeOptions.replaceChildren();
}

/** Resolve an open chime as "no steering" (used by skip). */
export function cancelChime() {
  openChime?.cancel();
}

/** Cleanup handle for an open source-confirmation panel, if any. */
let openConfirm = null;

/**
 * Show the source-confirmation panel on the setup view — the same
 * "quick check-in before committing compute" pattern as the chime, and the
 * same visual language (it reuses the chime panel styles). No auto-continue:
 * a validation checkpoint shouldn't spend compute on a maybe-wrong article.
 * @param {string} topic
 * @param {import('./wikipedia.js').Candidate[]} candidates
 * @returns {Promise<import('./wikipedia.js').Candidate|null>}
 *   The picked candidate, or null for "none of these — refine my search".
 */
export function showSourceConfirm(topic, candidates) {
  cancelSourceConfirm(); // resolve any stale panel before opening a new one

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      hideSourceConfirm();
      resolve(value);
    };

    els.confirmPrompt.textContent = `Here's what I found for "${topic}" — which one did you mean?`;
    els.confirmOptions.replaceChildren(
      ...candidates.map((candidate) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn candidate';
        const title = document.createElement('span');
        title.className = 'candidate__title';
        title.textContent = candidate.title;
        const desc = document.createElement('span');
        desc.className = 'candidate__desc';
        desc.textContent =
          candidate.description || candidate.summary.slice(0, 140) || 'No description available';
        btn.append(title, desc);
        btn.addEventListener('click', () => settle(candidate));
        li.append(btn);
        return li;
      })
    );

    const onNone = () => settle(null);
    els.confirmNoneBtn.addEventListener('click', onNone);

    openConfirm = {
      cancel: () => settle(null),
      cleanup: () => els.confirmNoneBtn.removeEventListener('click', onNone),
    };

    els.confirmPanel.hidden = false;
  });
}

/** Hide the source-confirmation panel and tear down its listeners. */
export function hideSourceConfirm() {
  if (openConfirm) {
    openConfirm.cleanup();
    openConfirm = null;
  }
  els.confirmPanel.hidden = true;
  els.confirmOptions.replaceChildren();
}

/** Resolve an open confirmation as "none of these" (used on new run/restart). */
export function cancelSourceConfirm() {
  openConfirm?.cancel();
}

/**
 * Render the final full transcript into the done view.
 * @param {import('./claude.js').DialogueLine[]} allLines
 */
export function renderFullTranscript(allLines) {
  els.fullTranscript.replaceChildren(...allLines.map(buildLineEl));
}

/**
 * Register the top-level UI event handlers app.js cares about.
 * @param {{onStart: () => void, onSkip: () => void, onRestart: () => void}} handlers
 */
export function bindHandlers(handlers) {
  els.setupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handlers.onStart();
  });
  els.skipBtn.addEventListener('click', handlers.onSkip);
  els.restartBtn.addEventListener('click', handlers.onRestart);
}
