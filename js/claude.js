/**
 * claude.js — the Chapter Generation step (spec §3, §5).
 *
 * One call per chapter. Given the Wikipedia source, a running summary of prior
 * chapters, and the listener's last steering choice, ask Claude for a chapter
 * as structured JSON: an array of dialogue lines plus a chime (and a one-line
 * summary we feed forward into the next chapter's prompt).
 *
 * Called directly from the browser via fetch — the API's CORS opt-in header
 * (`anthropic-dangerous-direct-browser-access`) makes this possible without a
 * backend. The paste-your-own-key flow is the known POC rough edge from spec
 * §6; the key never leaves the browser except to api.anthropic.com.
 *
 * Structured outputs (`output_config.format` with a JSON schema) guarantee the
 * response parses — no code-fence stripping or retry-on-bad-JSON needed.
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
 * @property {string}         summary  One-sentence recap, fed into chapter N+1.
 */

/**
 * @typedef {Object} GenerateChapterInput
 * @property {string}  topic
 * @property {'quick'|'deep'} depth
 * @property {string}  source          Wikipedia summary/extract (+ any Wikinews coverage) to ground in.
 * @property {string}  priorSummary    Running summary of earlier chapters ('' for ch. 1).
 * @property {string|null} [steering]  Direction for this chapter, if any.
 * @property {'listener'|'default'} [steeringKind]  Whether the listener picked it,
 *   or it's the default path the hosts previewed (taken when the listener stays quiet).
 * @property {number}  chapterIndex    0-based.
 * @property {number}  chapterTarget   Total chapters planned.
 */

/** JSON schema for the structured output (spec §5's "structured JSON only"). */
const CHAPTER_SCHEMA = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          speaker: { type: 'string', enum: ['A', 'B'] },
          text: { type: 'string' },
        },
        required: ['speaker', 'text'],
        additionalProperties: false,
      },
    },
    chime: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        options: { type: 'array', items: { type: 'string' } },
      },
      required: ['prompt', 'options'],
      additionalProperties: false,
    },
    summary: { type: 'string' },
  },
  required: ['lines', 'chime', 'summary'],
  additionalProperties: false,
};

/**
 * Build the system + user prompt for one chapter. Kept pure/testable.
 * @param {GenerateChapterInput} input
 * @returns {{system: string, messages: Array<{role: string, content: string}>}}
 */
export function buildChapterPrompt(input) {
  const { topic, depth, source, priorSummary, steering, steeringKind, chapterIndex, chapterTarget } = input;
  const isFirst = chapterIndex === 0;
  const isLast = chapterIndex === chapterTarget - 1;

  const system = [
    'You write dialogue scripts for a live two-host podcast called NowPod.',
    `Host A is "${HOSTS.A.name}": ${HOSTS.A.role}`,
    `Host B is "${HOSTS.B.name}": ${HOSTS.B.role}`,
    '',
    'Rules:',
    `- Write ${CHAPTER_SHAPE.minExchanges}-${CHAPTER_SHAPE.maxExchanges} short spoken exchanges, alternating between hosts.`,
    '- Ground every factual claim in the provided source material. If the source is thin on a requested direction, do your best with what it supports and keep the tone honest. News coverage, when provided, is supplementary color — ignore it if it is not relevant to the topic.',
    '- Lines are spoken aloud by TTS: conversational, no stage directions, no markdown, no URLs.',
    ...(isLast
      ? [
          '- This is the FINAL chapter: wrap the show up warmly in the closing lines. Still include a chime object (it will not be shown), with options for hypothetical future episodes.',
        ]
      : [
          '- The FINAL 2-3 exchanges of the chapter ARE the transition into the next chapter, written fully in-character. Never a bolted-on "please choose" or "let us know" callout — the show must never sound like it is waiting on the listener.',
          '  - First, Host A recaps what the chapter covered and — as a real spoken sentence, not a labeled menu — previews the natural default path for the next chapter, a second more complex thread that would normally come later, and teases a third thing that did not get covered at all.',
          '  - Then Host B riffs for roughly 10-15 seconds of speech (2-4 sentences): reacting to one of those directions, picking a favorite, or admitting which one they personally found hardest to grasp at first. This riff is the buffer that gives the listener time to steer.',
          '- The "chime" object mirrors that spoken transition for the UI: "prompt" is a short heading (a few words), and "options" is exactly 3 short labels in the order Host A named them — the DEFAULT path first (it is taken automatically if the listener stays quiet), then the more complex thread, then the teased uncovered thing.',
        ]),
    '- "summary" is one sentence capturing what this chapter covered, used as memory for the next chapter.',
  ].join('\n');

  const userParts = [
    `Topic: ${topic}`,
    `Depth: ${depth === 'deep' ? 'deep dive' : 'quick'}`,
    `Chapter ${chapterIndex + 1} of ${chapterTarget}.`,
    '',
    '<source_material>',
    source,
    '</source_material>',
  ];

  if (!isFirst && priorSummary) {
    userParts.push('', `Previously covered: ${priorSummary}`);
  }
  if (steering && steeringKind === 'listener') {
    userParts.push(
      '',
      `The listener steered the show at the last transition. Their choice: "${steering}". Make this chapter deliver on that direction.`
    );
  } else if (steering) {
    userParts.push(
      '',
      `The listener stayed quiet at the last transition, so continue down the default path the hosts previewed: "${steering}".`
    );
  } else if (!isFirst) {
    userParts.push('', 'Carry on naturally from where the show left off.');
  }

  userParts.push('', 'Write the next chapter now.');

  return {
    system,
    messages: [{ role: 'user', content: userParts.join('\n') }],
  };
}

/**
 * Parse + validate the model's response text into a Chapter, or throw.
 * Structured outputs make this near-guaranteed, but validate defensively.
 * @param {string} raw  Model text (a JSON object).
 * @returns {Chapter}
 */
export function parseChapterResponse(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    // Defensive fallback: strip accidental code fences.
    const stripped = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    data = JSON.parse(stripped);
  }

  const lines = (data.lines ?? []).filter(
    (l) => (l.speaker === 'A' || l.speaker === 'B') && typeof l.text === 'string' && l.text.trim()
  );
  if (lines.length === 0) {
    throw new Error('Chapter generation returned no usable dialogue lines.');
  }

  const chime = {
    prompt: typeof data.chime?.prompt === 'string' ? data.chime.prompt : 'Where should we take it next?',
    options: (data.chime?.options ?? []).filter((o) => typeof o === 'string' && o.trim()).slice(0, 3),
  };

  return {
    lines,
    chime,
    summary: typeof data.summary === 'string' ? data.summary : lines[0].text,
  };
}

/**
 * Generate one chapter end-to-end.
 * @param {GenerateChapterInput} input
 * @param {{apiKey: string, signal?: AbortSignal}} opts
 * @returns {Promise<Chapter>}
 */
export async function generateChapter(input, opts) {
  if (!opts?.apiKey) {
    throw new Error('Missing Claude API key — paste one on the setup screen.');
  }

  const { system, messages } = buildChapterPrompt(input);

  const res = await fetch(CLAUDE.endpoint, {
    method: 'POST',
    signal: opts.signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': CLAUDE.apiVersion,
      // CORS opt-in for calling the API from a browser (POC only — see spec §6).
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE.model,
      max_tokens: CLAUDE.maxTokens,
      system,
      messages,
      // Sonnet 5 runs adaptive thinking when `thinking` is omitted; turn it
      // off — schema-constrained dialogue doesn't need it and latency matters.
      thinking: { type: 'disabled' },
      output_config: {
        // Low effort keeps chapter latency in the "few seconds" the POC targets.
        effort: 'low',
        format: { type: 'json_schema', schema: CHAPTER_SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const err = await res.json();
      detail = err?.error?.message ?? detail;
    } catch {
      /* keep status code */
    }
    throw new Error(`Chapter generation failed: ${detail}`);
  }

  const data = await res.json();
  const text = (data.content ?? []).find((b) => b.type === 'text')?.text;
  if (!text) {
    throw new Error(`Chapter generation returned no text (stop_reason: ${data.stop_reason}).`);
  }
  return parseChapterResponse(text);
}
