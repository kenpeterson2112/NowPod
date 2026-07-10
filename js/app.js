/**
 * app.js — orchestrator / state machine (spec §3).
 *
 * The seam this POC is really about: research → generate → play → chime → loop.
 * app.js holds the run state and drives the modules; every other file stays
 * ignorant of the others. Nothing here fetches or renders directly — it calls
 * wikipedia.js, claude.js, tts.js, and ui.js in order.
 *
 * SCAFFOLDING ONLY — the flow is sketched as commented steps, not implemented.
 *
 *   States: 'setup' → 'research' → 'generate' → 'play' → 'chime' → … → 'done'
 */

import { CHAPTER_TARGETS, CHIME_AUTOCONTINUE_MS } from './config.js';
import * as wikipedia from './wikipedia.js';
import * as claude from './claude.js';
import * as tts from './tts.js';
import * as ui from './ui.js';

/**
 * @typedef {Object} RunState
 * @property {string}  topic
 * @property {'quick'|'deep'} depth
 * @property {number}  chapterTarget
 * @property {number}  chapterIndex        Current chapter (0-based).
 * @property {import('./wikipedia.js').ResearchResult|null} research
 * @property {import('./claude.js').DialogueLine[]} allLines  Accumulated transcript.
 * @property {string}  priorSummary        Running summary fed into the next chapter.
 * @property {string|null} steering        Listener's last chime choice.
 */

/** @type {RunState|null} */
let state = null;

/** Entry point — wire UI + voices, show the setup view. */
async function main() {
  // TODO: ui.init(); ui.bindHandlers({ onStart, onSkip, onRestart });
  //       tts.initVoices() (best-effort); ui.showView('setup').
}

/** Setup submit → kick off a run. */
async function onStart() {
  // TODO: state = fresh RunState from ui.readSetup() + CHAPTER_TARGETS[depth];
  //       await runResearch(); then runChapterLoop().
}

/** Research step. */
async function runResearch() {
  // TODO: ui.setStatus('Researching…'); state.research = await wikipedia.research(...).
}

/**
 * The core loop: generate a chapter, play it, surface the chime, fold the
 * listener's steer into the next chapter — until chapterTarget is reached.
 */
async function runChapterLoop() {
  // TODO (per chapter):
  //   1. ui.setChapterHeader(...)
  //   2. chapter = await claude.generateChapter({ ...state })
  //   3. ui.renderChapterLines(chapter.lines); accumulate into state.allLines
  //   4. start playback: tts.speakChapter(lines, ui.highlightLine)   [do NOT await yet]
  //   5. BEFORE audio ends, ui.showChime(chapter.chime, CHIME_AUTOCONTINUE_MS)
  //      → capture state.steering (null on auto-continue)
  //   6. await the playback promise so chapters don't overlap
  //   7. update state.priorSummary + state.chapterIndex
  //   loop; when done → finish().
}

/** Skip button → cancel current speech and advance. */
function onSkip() {
  // TODO: tts.stop(); resolve current chime early; continue the loop.
}

/** Wrap up a completed run. */
function finish() {
  // TODO: ui.renderFullTranscript(state.allLines); ui.showView('done').
}

/** Restart → reset state and return to setup. */
function onRestart() {
  // TODO: tts.stop(); state = null; ui.showView('setup').
}

// Boot once the module loads.
main();
