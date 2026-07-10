/**
 * claude.js — the Chapter Generation step (spec §3, §5).
 *
 * One call per chapter. Given the Wikipedia source, a running summary of prior
 * chapters, and the listener's last steering choice, ask Claude to return a
 * chapter as STRUCTURED JSON ONLY: an array of dialogue lines plus a chime.
 *
 * SCAFFOLDING ONLY — the prompt builder and API call are stubbed.
 *
 * NOTE (spec §6): calling /v1/messages needs an API key. A browser-only POC has
 * no safe place to hold one — this is a known rough edge to flag, not solve here.
 * Options for later: a tiny proxy/server, or a paste-your-own-key dev field.
 */

import { CLAUDE, CHAPTER_SHAPE, HOSTS } from './config.js';

/**
 * @typedef {Object} DialogueLine
 * @property {'A'|'B'} speaker
 * @property {string}  text
 */

/**
 * @typedef {Object} Chime
 * @property {string}   prompt    In-narrative "next we could cover…" line.
 * @property {string[]} options   2–3 suggested directions.
 */

/**
 * @typedef {Object} Chapter
 * @property {DialogueLine[]} lines
 * @property {Chime}          chime
 */

/**
 * @typedef {Object} GenerateChapterInput
 * @property {string}  topic
 * @property {'quick'|'deep'} depth
 * @property {string}  source          Wikipedia summary/extract to ground in.
 * @property {string}  priorSummary    Running summary of earlier chapters ('' for ch. 1).
 * @property {string} [steering]       Listener's last chime choice/redirect, if any.
 * @property {number}  chapterIndex    0-based.
 * @property {number}  chapterTarget   Total chapters planned.
 */

/**
 * Build the system + user prompt that instructs Claude to return structured
 * JSON only. Kept pure/testable — no network.
 * @param {GenerateChapterInput} input
 * @returns {{system: string, messages: Array<{role: string, content: string}>}}
 */
export function buildChapterPrompt(input) {
  // TODO: compose instructions that:
  //   - cast Host A (HOSTS.A) and Host B (HOSTS.B) by their roles
  //   - ground strictly in `input.source`
  //   - honor `input.steering` for this chapter's direction
  //   - keep to CHAPTER_SHAPE.min/maxExchanges exchanges
  //   - return ONLY JSON: { lines: [...], chime: {...} }
  throw new Error('claude.buildChapterPrompt not implemented');
}

/**
 * Parse + validate the model's raw response into a Chapter, or throw.
 * @param {string} raw  Model text (expected to be a JSON object).
 * @returns {Chapter}
 */
export function parseChapterResponse(raw) {
  // TODO: JSON.parse, then validate speakers are 'A'|'B', text is non-empty,
  //       and chime has a prompt + 2–3 options.
  throw new Error('claude.parseChapterResponse not implemented');
}

/**
 * Generate one chapter end-to-end.
 * @param {GenerateChapterInput} input
 * @param {{apiKey?: string, signal?: AbortSignal}} [opts]
 * @returns {Promise<Chapter>}
 */
export async function generateChapter(input, opts = {}) {
  // TODO: buildChapterPrompt → POST CLAUDE.endpoint (model CLAUDE.model,
  //       max_tokens CLAUDE.maxTokens) → parseChapterResponse.
  throw new Error('claude.generateChapter not implemented');
}
