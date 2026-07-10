/**
 * app.js — orchestrator / state machine (spec §3).
 *
 * The seam this POC is about: research → generate → play → chime → loop.
 * app.js holds the run state and drives the modules; every other file stays
 * ignorant of the others.
 *
 * Incremental by design: chapter N+1 starts generating the moment the chime
 * resolves, while chapter N's audio is still finishing — so the show never
 * waits on a full render (the thing NotebookLM doesn't do, spec §1).
 */

import {
  CHAPTER_TARGETS,
  TRANSITION_LINES,
  API_KEY_STORAGE_KEY,
} from './config.js';
import * as wikipedia from './wikipedia.js';
import * as claude from './claude.js';
import * as tts from './tts.js';
import * as ui from './ui.js';

/**
 * @typedef {Object} RunState
 * @property {string}  topic
 * @property {'quick'|'deep'} depth
 * @property {string}  apiKey
 * @property {number}  chapterTarget
 * @property {number}  chapterIndex        Current chapter (0-based).
 * @property {import('./wikipedia.js').ResearchResult|null} research
 * @property {import('./claude.js').DialogueLine[]} allLines  Accumulated transcript.
 * @property {string}  priorSummary        Running summary fed into the next chapter.
 * @property {string|null} steering        Listener's last chime choice.
 * @property {number}  runId               Guards stale async work after a restart.
 */

/** @type {RunState|null} */
let state = null;
let runCounter = 0;

/** Entry point — wire UI + voices, show the setup view. */
function main() {
  ui.init();
  ui.bindHandlers({ onStart, onSkip, onRestart });
  ui.setApiKey(localStorage.getItem(API_KEY_STORAGE_KEY) ?? '');
  ui.showView('setup');
  tts.initVoices(); // best-effort warm-up; re-awaited implicitly by first speak
}

/** Setup submit → kick off a run. */
async function onStart() {
  const { topic, depth, apiKey } = ui.readSetup();
  if (!topic) return;
  if (!apiKey) {
    ui.setStatus('Paste a Claude API key to generate chapters.', true);
    return;
  }
  localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);

  ui.cancelSourceConfirm(); // a re-submitted form supersedes a pending confirmation

  state = {
    topic,
    depth,
    apiKey,
    chapterTarget: CHAPTER_TARGETS[depth],
    chapterIndex: 0,
    research: null,
    allLines: [],
    priorSummary: '',
    steering: null,
    steeringKind: 'default',
    runId: ++runCounter,
  };

  try {
    const ready = await runResearch();
    if (!ready || !isCurrentRun(state)) return;
    ui.setStatus('');
    ui.clearTranscript();
    ui.showView('player');
    await runChapterLoop();
  } catch (err) {
    if (!isCurrentRun(state)) return;
    tts.stop();
    ui.showView('setup');
    ui.setStatus(err?.message ?? 'Something went wrong — try again.', true);
  }
}

/** True while this run is still the active one (no restart happened). */
function isCurrentRun(run) {
  return run !== null && run === state && run.runId === runCounter;
}

/**
 * Research step with the source-validation checkpoint (between research and
 * generation): fetch candidate articles; if the match is ambiguous, ask the
 * listener which one they meant BEFORE any script-generation call is made.
 * A clear, unambiguous top match proceeds without friction.
 * @returns {Promise<boolean>} true when research is ready and the run should proceed.
 */
async function runResearch() {
  const run = state;
  ui.setStatus(`Researching "${run.topic}" on Wikipedia…`);
  const { candidates, needsConfirmation } = await wikipedia.researchCandidates(run.topic);
  if (!isCurrentRun(run)) return false;

  let chosen = candidates[0];
  if (needsConfirmation) {
    ui.setStatus('');
    chosen = await ui.showSourceConfirm(run.topic, candidates);
    if (!isCurrentRun(run)) return false;
    if (!chosen) {
      // "None of these" — back to the form, no compute spent.
      ui.setStatus('No problem — refine your topic and hit Start again.');
      return false;
    }
    ui.setStatus(`Researching "${chosen.title}"…`);
  }

  run.research = await wikipedia.finishResearch(chosen, run.depth);
  if (!isCurrentRun(run)) return false;

  // Reference list (spec §12): the actual articles fetched, not a generic note.
  ui.renderReferences(
    [
      { title: run.research.title, url: run.research.url, source: 'Wikipedia' },
      run.research.news && {
        title: run.research.news.title,
        url: run.research.news.url,
        source: 'Wikinews',
      },
    ].filter(Boolean)
  );
  return true;
}

/** Build the generation input for the current state. */
function chapterInput() {
  const { research } = state;
  const source = [
    `Encyclopedia background (Wikipedia — "${research.title}"):`,
    [research.summary, research.extract ?? ''].filter(Boolean).join('\n\n'),
    research.news
      ? `\nRecent news coverage (Wikinews — "${research.news.title}"), supplementary:\n${research.news.extract}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  return {
    topic: research.title,
    depth: state.depth,
    source,
    priorSummary: state.priorSummary,
    steering: state.steering,
    steeringKind: state.steeringKind,
    chapterIndex: state.chapterIndex,
    chapterTarget: state.chapterTarget,
  };
}

/** Per-chapter chime plumbing so skip can resolve it from outside the loop. */
let chimeResolve = null;

/**
 * The core loop: play chapter N while the chime collects steering, then
 * generate N+1 in parallel with N's audio tail — until the target is reached.
 */
async function runChapterLoop() {
  const run = state;

  // Chapter 1 generates while the player view settles.
  ui.setChapterHeader(run.research.title, `Generating chapter 1 of ${run.chapterTarget}…`);
  let pendingChapter = claude.generateChapter(chapterInput(), { apiKey: run.apiKey });

  while (isCurrentRun(run) && run.chapterIndex < run.chapterTarget) {
    const chapter = await pendingChapter;
    if (!isCurrentRun(run)) return;

    const chapterNo = run.chapterIndex + 1;
    const isLast = chapterNo === run.chapterTarget;
    ui.setChapterHeader(run.research.title, `Chapter ${chapterNo} of ${run.chapterTarget}`);
    ui.renderChapterLines(chapter.lines);
    run.allLines.push(...chapter.lines);

    // The chapter's final 2-3 exchanges ARE the transition (spec §11): the
    // chime panel appears when the transition starts and stays up for Host
    // B's riff — never a modal, never a pause on the audio.
    const chimeAt = Math.max(0, chapter.lines.length - TRANSITION_LINES);
    const chime = new Promise((resolve) => {
      chimeResolve = resolve;
    });

    const playback = tts.speakChapter(chapter.lines, (i) => {
      if (!isCurrentRun(run)) return;
      ui.highlightLine(i);
      if (!isLast && i === chimeAt) {
        ui.showChime(chapter.chime).then((choice) => chimeResolve?.(choice));
      }
    });

    if (!isLast) {
      // When the transition ends (or skip cuts it short) with no action
      // taken, the show takes the default path Host A named — no dead air,
      // no "waiting for input" state.
      playback.then(() => {
        ui.cancelChime();
        chimeResolve?.(null);
      });

      // An early pick resolves before the audio ends, so generation of N+1
      // starts in parallel with the riff's tail.
      const picked = await chime;
      if (!isCurrentRun(run)) return;
      run.steering = picked ?? chapter.chime.options[0] ?? null;
      run.steeringKind = picked ? 'listener' : 'default';
      run.priorSummary = [run.priorSummary, chapter.summary].filter(Boolean).join(' ');
      run.chapterIndex += 1;
      ui.setChapterHeader(
        run.research.title,
        `Chapter ${chapterNo} of ${run.chapterTarget} — generating next…`
      );
      pendingChapter = claude.generateChapter(chapterInput(), { apiKey: run.apiKey });
    } else {
      run.chapterIndex += 1;
    }

    await playback;
    chimeResolve = null;
    if (!isCurrentRun(run)) return;
  }

  finish();
}

/** Skip button → stop current audio; resolve an open chime as "no steering". */
function onSkip() {
  tts.stop();
  ui.cancelChime(); // resolves the chime promise via its own settle path
  chimeResolve?.(null); // covers the window before the chime panel appeared
}

/** Wrap up a completed run. */
function finish() {
  if (!state) return;
  ui.renderFullTranscript(state.allLines);
  ui.showView('done');
}

/** Restart → invalidate the run, stop audio, return to setup. */
function onRestart() {
  runCounter += 1;
  state = null;
  tts.stop();
  ui.hideChime();
  ui.hideSourceConfirm();
  ui.setStatus('');
  ui.showView('setup');
}

// Boot once the module loads.
main();
