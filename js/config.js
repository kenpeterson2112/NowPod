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

/** Wikipedia endpoints — no auth, CORS-friendly (spec §5). */
export const WIKIPEDIA = Object.freeze({
  search: (topic) =>
    `https://en.wikipedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(topic)}&format=json&origin=*`,
  summary: (title) =>
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
  fullExtract: (title) =>
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext` +
    `&titles=${encodeURIComponent(title)}&format=json&origin=*`,
});

/** Claude Messages API (spec §5). Key handling is a known POC rough edge (§6). */
export const CLAUDE = Object.freeze({
  endpoint: 'https://api.anthropic.com/v1/messages',
  model: 'claude-sonnet-5',
  maxTokens: 1024,
});

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

/** How long the chime waits before auto-continuing, in ms (spec §3). */
export const CHIME_AUTOCONTINUE_MS = 8000;
