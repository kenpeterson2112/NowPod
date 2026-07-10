/**
 * tts.js — the Voice step (spec §5, §6).
 *
 * Browser TTS via the Web Speech API (speechSynthesis) — free, no key. Picks
 * two distinct voices (falling back to pitch/rate variation on one voice) and
 * assigns one per host. Utterances play line by line so ui.js can karaoke-
 * highlight the active line via the onLineStart callback.
 *
 * Robustness (spec §8 says voice variance is expected and fine):
 * - Some environments have zero voices or fail synthesis outright. Those
 *   lines degrade to silent read-along pacing via a duration-estimate timer,
 *   so the karaoke transcript still advances at reading speed.
 * - stop() settles any pending line immediately, so skip/restart never wait
 *   out a pacing timer.
 */

import { HOSTS } from './config.js';

/** Resolved voice assignment: one SpeechSynthesisVoice (or null) per host id. */
const voiceMap = { A: null, B: null };

/** Cancellation token for the chapter currently being spoken. */
let activeSession = null;

/** Wait for speechSynthesis.getVoices() to populate (it's async in most browsers). */
function loadVoices() {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) return resolve([]);

    const existing = synth.getVoices();
    if (existing.length > 0) return resolve(existing);

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve(synth.getVoices());
    };
    synth.addEventListener('voiceschanged', settle, { once: true });
    setTimeout(settle, 1500); // some environments never fire voiceschanged
  });
}

/**
 * Load available voices and assign one to each host. Best-effort: with one
 * voice (or none) the hosts still sound distinct via pitch/rate hints.
 * @returns {Promise<void>}
 */
export async function initVoices() {
  const voices = await loadVoices();
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
  const pool = english.length > 0 ? english : voices;

  voiceMap.A = pool[0] ?? null;
  // Prefer a second voice with a different name; otherwise reuse voice A
  // and let the pitch/rate hints differentiate (spec §5 fallback).
  voiceMap.B = pool.find((v) => v.name !== voiceMap.A?.name) ?? voiceMap.A;
}

/**
 * Speak a single dialogue line in its host's voice. Always resolves — on
 * `end`, on cancellation, or on the duration-estimate pacing timer.
 * @param {import('./claude.js').DialogueLine} line
 * @param {{session?: {cancelled: boolean, cancelHooks: Set<Function>}}} [opts]
 * @returns {Promise<void>}
 */
export function speakLine(line, opts = {}) {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const session = opts.session;
    const hint = HOSTS[line.speaker]?.voiceHint ?? {};

    // ~75ms per character approximates speech rate; generous floor + ceiling.
    const fallbackMs = Math.min(30000, 1500 + line.text.length * 75);

    let settled = false;
    let timer = null;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      session?.cancelHooks.delete(settle);
      resolve();
    };
    session?.cancelHooks.add(settle); // stop() settles us immediately

    if (session?.cancelled) return settle();
    if (!synth) {
      timer = setTimeout(settle, fallbackMs); // silent read-along pacing
      return;
    }

    const u = new SpeechSynthesisUtterance(line.text);
    if (voiceMap[line.speaker]) u.voice = voiceMap[line.speaker];
    u.pitch = hint.pitch ?? 1.0;
    u.rate = hint.rate ?? 1.0;
    u.onend = settle;
    u.onerror = (e) => {
      // 'canceled'/'interrupted' come from stop() — settle right away.
      // Anything else (e.g. 'synthesis-failed' on voiceless setups) falls
      // back to the pacing timer so the transcript reads along silently.
      if (e.error === 'canceled' || e.error === 'interrupted') settle();
    };
    timer = setTimeout(settle, fallbackMs);

    synth.speak(u);
  });
}

/**
 * Speak an ordered list of lines, one after another.
 * @param {import('./claude.js').DialogueLine[]} lines
 * @param {(index: number) => void} [onLineStart]  Fires as each line begins (for highlighting).
 * @returns {Promise<void>} Resolves when the chapter finishes (or is stopped).
 */
export async function speakChapter(lines, onLineStart) {
  const session = { cancelled: false, cancelHooks: new Set() };
  activeSession = session;

  for (let i = 0; i < lines.length; i++) {
    if (session.cancelled) break;
    onLineStart?.(i);
    await speakLine(lines[i], { session });
  }
}

/** Stop all speech immediately (used on skip/restart). */
export function stop() {
  if (activeSession) {
    activeSession.cancelled = true;
    for (const hook of [...activeSession.cancelHooks]) hook();
  }
  window.speechSynthesis?.cancel();
}
