/**
 * wikipedia.js — the Research step (spec §3, §5).
 *
 * Fetches the source material a chapter is grounded in: find the best-matching
 * article for a topic, then pull a summary (quick) or the fuller article body
 * (deep dive). No auth, CORS-friendly.
 *
 * SCAFFOLDING ONLY — signatures and shapes are defined; the fetch/parse bodies
 * are stubbed with TODOs.
 */

import { WIKIPEDIA } from './config.js';

/**
 * @typedef {Object} ResearchResult
 * @property {string} title    Resolved Wikipedia article title.
 * @property {string} summary  Short summary (always populated).
 * @property {string} [extract] Fuller plain-text body (deep dive only).
 * @property {string} url      Canonical article URL, for attribution.
 */

/**
 * Resolve a free-text topic to the best-matching Wikipedia article title.
 * @param {string} topic
 * @returns {Promise<string|null>} Article title, or null if nothing matched.
 */
export async function searchTopic(topic) {
  // TODO: fetch WIKIPEDIA.search(topic); return the first result's `title`.
  throw new Error('wikipedia.searchTopic not implemented');
}

/**
 * Pull the short summary for an article.
 * @param {string} title
 * @returns {Promise<{summary: string, url: string}>}
 */
export async function fetchSummary(title) {
  // TODO: fetch WIKIPEDIA.summary(title); read `extract` and `content_urls`.
  throw new Error('wikipedia.fetchSummary not implemented');
}

/**
 * Pull the fuller plain-text article body (deep dive only).
 * @param {string} title
 * @returns {Promise<string>} Plain-text extract.
 */
export async function fetchFullExtract(title) {
  // TODO: fetch WIKIPEDIA.fullExtract(title); dig out pages[*].extract.
  throw new Error('wikipedia.fetchFullExtract not implemented');
}

/**
 * Orchestrates the whole Research step for a topic at a given depth.
 * @param {string} topic
 * @param {'quick'|'deep'} depth
 * @returns {Promise<ResearchResult>}
 */
export async function research(topic, depth) {
  // TODO: searchTopic → fetchSummary → (if deep) fetchFullExtract.
  //       Assemble and return a ResearchResult.
  throw new Error('wikipedia.research not implemented');
}
