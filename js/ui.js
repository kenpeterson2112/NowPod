/**
 * ui.js — all DOM rendering for the POC (spec §3, §5).
 *
 * Owns view switching, transcript rendering + karaoke highlighting, and the
 * non-modal chime panel. Deliberately dumb: it renders what app.js hands it and
 * reports user intent back through callbacks. No fetching, no TTS, no state.
 *
 * SCAFFOLDING ONLY — element lookups are wired; render bodies are stubbed.
 */

/** Cached element references, populated by init(). */
const els = {};

/**
 * Grab element references. Call once on load.
 */
export function init() {
  // TODO: populate `els` from document.getElementById for each view + slot.
  throw new Error('ui.init not implemented');
}

/**
 * Show exactly one view, hide the others.
 * @param {'setup'|'player'|'done'} name
 */
export function showView(name) {
  // TODO: toggle [hidden] / .view--active across #setup-view/#player-view/#done-view.
  throw new Error('ui.showView not implemented');
}

/**
 * Read the setup form.
 * @returns {{topic: string, depth: 'quick'|'deep'}}
 */
export function readSetup() {
  // TODO: read #topic-input + checked depth radio.
  throw new Error('ui.readSetup not implemented');
}

/**
 * Write a status/progress message (research, generating…).
 * @param {string} message
 */
export function setStatus(message) {
  // TODO: set #setup-status textContent.
  throw new Error('ui.setStatus not implemented');
}

/**
 * Update the player topbar (topic title + "Chapter N of M").
 * @param {string} topicTitle
 * @param {number} chapterIndex 0-based
 * @param {number} chapterTarget
 */
export function setChapterHeader(topicTitle, chapterIndex, chapterTarget) {
  // TODO: fill data-slot="topic-title" and data-slot="chapter-progress".
  throw new Error('ui.setChapterHeader not implemented');
}

/**
 * Append a chapter's dialogue lines to the transcript (initially un-highlighted).
 * @param {import('./claude.js').DialogueLine[]} lines
 */
export function renderChapterLines(lines) {
  // TODO: build <li class="line line--host-a|b"> nodes into #transcript.
  throw new Error('ui.renderChapterLines not implemented');
}

/**
 * Mark one transcript line as the active (currently-spoken) one.
 * @param {number} lineIndex Index within the current chapter's lines.
 */
export function highlightLine(lineIndex) {
  // TODO: move .line--active to the matching <li>; scroll into view.
  throw new Error('ui.highlightLine not implemented');
}

/**
 * Show the non-modal chime panel. MUST NOT pause audio (spec §5). Resolves when
 * the listener picks/types a redirect, or auto-continues on timeout.
 * @param {import('./claude.js').Chime} chime
 * @param {number} autoContinueMs
 * @returns {Promise<string|null>} Chosen/typed steering text, or null on auto-continue.
 */
export function showChime(chime, autoContinueMs) {
  // TODO: render prompt + option buttons + redirect form into #chime-panel,
  //       start a countdown, resolve on click/submit/timeout, then hideChime().
  throw new Error('ui.showChime not implemented');
}

/** Hide the chime panel. */
export function hideChime() {
  // TODO: set #chime-panel hidden, clear injected options.
  throw new Error('ui.hideChime not implemented');
}

/**
 * Render the final full transcript into the done view.
 * @param {import('./claude.js').DialogueLine[]} allLines
 */
export function renderFullTranscript(allLines) {
  // TODO: fill #full-transcript from every chapter's lines.
  throw new Error('ui.renderFullTranscript not implemented');
}

/**
 * Register the top-level UI event handlers app.js cares about.
 * @param {{onStart: () => void, onSkip: () => void, onRestart: () => void}} handlers
 */
export function bindHandlers(handlers) {
  // TODO: wire #setup-form submit, #skip-btn, #restart-btn to handlers.
  throw new Error('ui.bindHandlers not implemented');
}
