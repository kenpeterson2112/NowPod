/**
 * config.js — shared constants for the NowPod POC.
 *
 * Centralizes the values the spec pins down: endpoints, depth → chapter targets,
 * the hardcoded host personas, and chapter shape. No logic here.
 */

/** Depth setting → target number of chapters (spec §3). */
export const CHAPTER_TARGETS = Object.freeze({
  quick: 2,
  deep: 4,
});

/** Chapter shape guidance (spec §5): keep chapters short and fast. */
export const CHAPTER_SHAPE = Object.freeze({
  minExchanges: 6,
  maxExchanges: 10,
});

/** How many candidate articles the source-confirmation step offers. */
export const CANDIDATE_COUNT = 3;

/** Wikipedia endpoints — no auth, CORS-friendly (spec §5). */
export const WIKIPEDIA = Object.freeze({
  search: (topic) =>
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=5` +
    `&srsearch=${encodeURIComponent(topic)}&format=json&origin=*`,
  summary: (title) =>
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
  fullExtract: (title) =>
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext` +
    `&titles=${encodeURIComponent(title)}&format=json&origin=*`,
});

/**
 * Claude Messages API (spec §5). Called directly from the browser with the
 * CORS opt-in header — the paste-your-own-key flow is the known POC rough
 * edge from spec §6 (no backend to hold a key).
 */
export const CLAUDE = Object.freeze({
  endpoint: 'https://api.anthropic.com/v1/messages',
  // Sonnet: grounded JSON dialogue doesn't need Opus-level reasoning, and
  // per-chapter latency/cost matter more here.
  model: 'claude-sonnet-5',
  apiVersion: '2023-06-01',
  // Headroom for Sonnet 5's tokenizer (~30% more tokens for the same text).
  maxTokens: 3072,
});

/** localStorage key for the paste-your-own-key dev flow. */
export const API_KEY_STORAGE_KEY = 'nowpod_api_key';

/**
 * Wikinews — second source (spec §5). Same MediaWiki API shape as Wikipedia,
 * same CORS-friendly origin=* pattern, no auth. Fail-soft: most topics have
 * no news coverage, and that's fine.
 */
export const WIKINEWS = Object.freeze({
  search: (topic) =>
    `https://en.wikinews.org/w/api.php?action=query&list=search&srlimit=3` +
    `&srsearch=${encodeURIComponent(topic)}&format=json&origin=*`,
  extract: (title) =>
    `https://en.wikinews.org/w/api.php?action=query&prop=extracts&explaintext` +
    `&titles=${encodeURIComponent(title)}&format=json&origin=*`,
  articleUrl: (title) =>
    `https://en.wikinews.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
});

/** Cap on how much Wikipedia text we feed a generation call ("light depth"). */
export const SOURCE_CHAR_LIMIT = 8000;

/** Cap on supplementary Wikinews text per generation call. */
export const NEWS_CHAR_LIMIT = 3000;

/**
 * The two hardcoded hosts (spec §4). Generic, reusable placeholders — not a
 * long-term design decision. `voiceHint` is used by tts.js when picking/tuning
 * a Web Speech voice.
 */
export const HOSTS = Object.freeze({
  A: {
    id: 'A',
    name: 'the Explainer',
    role: 'Grounds each topic; asks the obvious question a smart newcomer would ask.',
    voiceHint: { pitch: 1.0, rate: 1.0 },
  },
  B: {
    id: 'B',
    name: 'the Enthusiast',
    role: 'Supplies the color and "wait, that\'s wild" reactions; pushes for depth.',
    voiceHint: { pitch: 1.15, rate: 1.05 },
  },
});

/**
 * How many closing exchanges form the in-narrative transition (spec §11):
 * Host A's recap-and-preview plus Host B's riff. The chime panel appears when
 * the transition starts and auto-continues down the default path when it ends.
 */
export const TRANSITION_LINES = 3;
