/**
 * tts.js — the Voice step (spec §5, §6).
 *
 * Browser TTS via the Web Speech API (speechSynthesis) — free, no key. Picks two
 * distinct voices (falling back to pitch/rate variation if only one exists) and
 * assigns one per host. Utterances are queued line by line so ui.js can karaoke-
 * highlight the active line via the onLineStart callback.
 *
 * SCAFFOLDING ONLY — voice selection and the speak queue are stubbed.
 */

import { HOSTS } from './config.js';

/** Resolved voice assignment: one SpeechSynthesisVoice (or hint) per host id. */
let voiceMap = /** @type {Record<'A'|'B', SpeechSynthesisVoice|null>} */ ({ A: null, B: null });

/**
 * Load available voices and assign one to each host. Handles the async
 * `voiceschanged` event (voices are often empty on first call).
 * @returns {Promise<void>}
 */
export async function initVoices() {
  // TODO: await speechSynthesis.getVoices() (wait for 'voiceschanged' if empty),
  //       pick two distinct voices, store in voiceMap. Fall back to a single
  //       voice + HOSTS.*.voiceHint pitch/rate if only one is available.
  throw new Error('tts.initVoices not implemented');
}

/**
 * Speak a single dialogue line in its host's voice.
 * @param {import('./claude.js').DialogueLine} line
 * @param {{onStart?: () => void, onEnd?: () => void}} [callbacks]
 * @returns {Promise<void>} Resolves when the line finishes.
 */
export function speakLine(line, callbacks = {}) {
  // TODO: build a SpeechSynthesisUtterance, apply voiceMap[line.speaker] +
  //       voiceHint, wire onstart/onend to callbacks, speechSynthesis.speak().
  throw new Error('tts.speakLine not implemented');
}

/**
 * Speak an ordered list of lines, one after another.
 * @param {import('./claude.js').DialogueLine[]} lines
 * @param {(index: number) => void} [onLineStart]  Fires as each line begins (for highlighting).
 * @returns {Promise<void>} Resolves when the whole chapter has been spoken.
 */
export async function speakChapter(lines, onLineStart) {
  // TODO: sequentially await speakLine for each line, calling onLineStart(i).
  throw new Error('tts.speakChapter not implemented');
}

/** Stop all speech immediately (used on skip/restart). */
export function stop() {
  // TODO: speechSynthesis.cancel();
  throw new Error('tts.stop not implemented');
}
