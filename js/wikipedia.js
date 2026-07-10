/**
 * wikipedia.js — the Research step (spec §3, §5).
 *
 * Fetches the source material a chapter is grounded in: find the best-matching
 * article for a topic, then pull a summary (quick) or the fuller article body
 * (deep dive). No auth, CORS-friendly.
 */

import { WIKIPEDIA, SOURCE_CHAR_LIMIT } from './config.js';

/**
 * @typedef {Object} ResearchResult
 * @property {string} title    Resolved Wikipedia article title.
 * @property {string} summary  Short summary (always populated).
 * @property {string} [extract] Fuller plain-text body (deep dive only).
 * @property {string} url      Canonical article URL, for attribution.
 */

/** Fetch JSON with a readable error on non-2xx responses. */
async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Wikipedia request failed (${res.status}) for ${url}`);
  }
  return res.json();
}

/**
 * Resolve a free-text topic to the best-matching Wikipedia article title.
 * @param {string} topic
 * @returns {Promise<string|null>} Article title, or null if nothing matched.
 */
export async function searchTopic(topic) {
  const data = await getJson(WIKIPEDIA.search(topic));
  const hits = data?.query?.search ?? [];
  return hits.length > 0 ? hits[0].title : null;
}

/**
 * Pull the short summary for an article.
 * @param {string} title
 * @returns {Promise<{summary: string, url: string}>}
 */
export async function fetchSummary(title) {
  const data = await getJson(WIKIPEDIA.summary(title));
  return {
    summary: data?.extract ?? '',
    url:
      data?.content_urls?.desktop?.page ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  };
}

/**
 * Pull the fuller plain-text article body (deep dive only).
 * @param {string} title
 * @returns {Promise<string>} Plain-text extract, capped at SOURCE_CHAR_LIMIT.
 */
export async function fetchFullExtract(title) {
  const data = await getJson(WIKIPEDIA.fullExtract(title));
  const pages = data?.query?.pages ?? {};
  const first = Object.values(pages)[0];
  const text = first?.extract ?? '';
  return text.slice(0, SOURCE_CHAR_LIMIT);
}

/**
 * Orchestrates the whole Research step for a topic at a given depth.
 * @param {string} topic
 * @param {'quick'|'deep'} depth
 * @returns {Promise<ResearchResult>}
 */
export async function research(topic, depth) {
  const title = await searchTopic(topic);
  if (!title) {
    throw new Error(`No Wikipedia article found for "${topic}" — try another topic.`);
  }

  const { summary, url } = await fetchSummary(title);
  const result = { title, summary, url };

  if (depth === 'deep') {
    // Best-effort: a thin/missing full extract shouldn't sink the run (spec §8).
    try {
      result.extract = await fetchFullExtract(title);
    } catch {
      result.extract = '';
    }
  }

  return result;
}
