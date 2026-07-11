/**
 * wikipedia.js — the Research step (spec §3, §5), now in two phases:
 *
 *   1. researchCandidates(topic) — search, pull the top candidate articles
 *      (title + one-line description + summary), and decide whether the match
 *      is ambiguous enough to warrant a user confirmation before any script
 *      generation spends compute.
 *   2. finishResearch(candidate, depth) — turn the confirmed candidate into
 *      the ResearchResult chapters are grounded in (adds the fuller article
 *      body on deep dive).
 *
 * No auth, CORS-friendly.
 */

import { WIKIPEDIA, WIKINEWS, SOURCE_CHAR_LIMIT, NEWS_CHAR_LIMIT, CANDIDATE_COUNT } from './config.js';

/**
 * @typedef {Object} Candidate
 * @property {string} title        Wikipedia article title.
 * @property {string} description  One-liner for the confirm UI (may be '').
 * @property {string} summary      Article summary (reused for generation).
 * @property {string} url          Canonical article URL.
 */

/**
 * @typedef {Object} NewsResult
 * @property {string} title    Wikinews article title.
 * @property {string} extract  Plain-text article body (capped).
 * @property {string} url      Canonical article URL, for attribution.
 */

/**
 * @typedef {Object} ResearchResult
 * @property {string} title    Resolved Wikipedia article title.
 * @property {string} summary  Short summary (always populated).
 * @property {string} [extract] Fuller plain-text body (deep dive only).
 * @property {NewsResult|null} news  Wikinews coverage, when any exists.
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
 * Search for candidate article titles for a free-text topic.
 * @param {string} topic
 * @returns {Promise<string[]>} Titles, best match first (may be empty).
 */
export async function searchTitles(topic) {
  const data = await getJson(WIKIPEDIA.search(topic));
  return (data?.query?.search ?? []).map((hit) => hit.title);
}

/**
 * Pull the summary card for an article: extract, one-line description, URL,
 * and whether the page is a disambiguation page.
 * @param {string} title
 * @returns {Promise<{summary: string, description: string, url: string, isDisambiguation: boolean}>}
 */
export async function fetchSummary(title) {
  const data = await getJson(WIKIPEDIA.summary(title));
  return {
    summary: data?.extract ?? '',
    description: data?.description ?? '',
    url:
      data?.content_urls?.desktop?.page ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    isDisambiguation: data?.type === 'disambiguation',
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
 * Look up Wikinews coverage for a confirmed topic (spec §5). Fail-soft by
 * design: most topics have no news coverage, and a Wikinews hiccup must never
 * block the show — this returns null instead of throwing.
 * @param {string} topic  The confirmed article title (post-disambiguation).
 * @returns {Promise<NewsResult|null>}
 */
export async function lookupNews(topic) {
  try {
    const search = await getJson(WIKINEWS.search(topic));
    const hit = search?.query?.search?.[0];
    if (!hit?.title) return null;

    const data = await getJson(WIKINEWS.extract(hit.title));
    const page = Object.values(data?.query?.pages ?? {})[0];
    const extract = (page?.extract ?? '').slice(0, NEWS_CHAR_LIMIT);
    if (!extract) return null;

    return { title: hit.title, extract, url: WIKINEWS.articleUrl(hit.title) };
  } catch {
    return null;
  }
}

/**
 * Ambiguity heuristic: prompt only when there's real disambiguation risk.
 * Runner-up candidates whose titles contain the topic itself ("Honda Odyssey",
 * "Odyssey (spacecraft)" for "odyssey") are same-name variants — the search
 * ranking alone can't tell which one the listener meant. Merely-related
 * runners-up ("Espresso" for "espresso machine") are not a risk, so a clear
 * top match proceeds without friction.
 * @param {string} topic
 * @param {Candidate[]} candidates
 * @returns {boolean}
 */
export function titlesCollide(topic, candidates) {
  if (candidates.length <= 1) return false;
  const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const t = norm(topic);
  return candidates.slice(1).some((c) => norm(c.title).includes(t));
}

/**
 * Phase 1 of research: find candidate articles and flag ambiguity.
 * @param {string} topic
 * @returns {Promise<{candidates: Candidate[], needsConfirmation: boolean}>}
 */
export async function researchCandidates(topic) {
  const titles = await searchTitles(topic);
  if (titles.length === 0) {
    throw new Error(`No Wikipedia article found for "${topic}" — try another topic.`);
  }

  // Summaries in parallel; a candidate whose summary fetch fails is dropped.
  const cards = await Promise.all(
    titles.map((title) =>
      fetchSummary(title)
        .then((card) => ({ title, ...card }))
        .catch(() => null)
    )
  );
  const usable = cards.filter(Boolean);

  // A disambiguation page in the results is a loud signal the topic is
  // ambiguous — always confirm. The page itself isn't a narratable source,
  // so it's excluded from the options.
  const hitDisambiguation = usable.some((c) => c.isDisambiguation);
  const candidates = usable
    .filter((c) => !c.isDisambiguation)
    .slice(0, CANDIDATE_COUNT)
    .map(({ title, description, summary, url }) => ({ title, description, summary, url }));

  if (candidates.length === 0) {
    throw new Error(`Only disambiguation pages found for "${topic}" — try a more specific topic.`);
  }

  return {
    candidates,
    needsConfirmation: hitDisambiguation || titlesCollide(topic, candidates),
  };
}

/**
 * Phase 2 of research: build the generation source from a confirmed candidate.
 * @param {Candidate} candidate
 * @param {'quick'|'deep'} depth
 * @returns {Promise<ResearchResult>}
 */
export async function finishResearch(candidate, depth) {
  const result = {
    title: candidate.title,
    summary: candidate.summary,
    url: candidate.url,
    news: null,
  };

  // Wikinews runs in parallel with the deep-dive extract; both fail-soft.
  const [news, extract] = await Promise.all([
    lookupNews(candidate.title),
    depth === 'deep' ? fetchFullExtract(candidate.title).catch(() => '') : Promise.resolve(undefined),
  ]);

  result.news = news;
  if (extract !== undefined) result.extract = extract;

  return result;
}
