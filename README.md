# NowPod — Bespoke Podcast Generator (POC)

An experimental proof of concept for a **bespoke, steerable podcast generator**.
You type a topic; two AI hosts research it on Wikipedia (plus Wikinews, when
the topic has news coverage) and narrate it to you as a live-feeling show —
generated **chapter by chapter** so audio starts fast, and **steerable
mid-show** through an in-narrative "chime" transition written into each
chapter's closing lines.

> **Status:** POC implemented. The full loop works — Wikipedia research,
> chapter-by-chapter generation via the Claude API, browser TTS with two
> voices, karaoke transcript, and the non-blocking chime.

## What this POC is trying to prove

NotebookLM can already narrate an article. This POC targets the two things it
*doesn't* do:

1. **Incremental chapters** — chapters generate and play one at a time instead of
   one long render-then-wait block.
2. **Listener steering** — the listener can redirect the show between chapters via
   an in-narrative "chime," without pausing or breaking the illusion of a live show.

See [`docs/spec.md`](docs/spec.md) for the full build spec.

## Explicit non-goals for this build

- No real ElevenLabs integration — browser TTS (Web Speech API) stands in.
- No paid/licensed sources — Wikipedia + Wikinews only.
- No user accounts, saved history, or persistence.
- No persona roster — one hardcoded host pairing.
- No ad breaks.

## The two hosts (hardcoded for the POC)

- **Host A — "the Explainer":** grounds each topic, asks the obvious question a
  smart newcomer would ask.
- **Host B — "the Enthusiast":** supplies the color and the "wait, that's wild"
  reactions, pushes for the next layer of depth.

A deliberately generic, reusable placeholder — not a long-term design decision.

## Project structure

```
NowPod/
├── index.html              # Single-page app shell (setup → player → done)
├── css/
│   └── styles.css          # All styling
├── js/
│   ├── config.js           # Constants: endpoints, depth→chapter targets, personas
│   ├── wikipedia.js        # Research: Wikipedia search + extract
│   ├── claude.js           # Script generation via the /v1/messages API
│   ├── tts.js              # Browser TTS (Web Speech API), two-voice alternation
│   ├── ui.js               # DOM rendering: transcript, highlighting, chime panel
│   └── app.js              # Orchestrator / state machine tying it all together
├── docs/
│   └── spec.md             # The POC build spec
└── .github/                # PR + issue templates
```

## Architecture at a glance

```
[Setup]  topic + depth
   ↓
[Research]          js/wikipedia.js   → top candidate articles + summaries
   ↓
[Confirm source]   js/ui.js          → only when the topic is ambiguous:
   ↓                                   "which one did you mean?" before any
   ↓                                   generation compute is spent
[Generate Ch. N]   js/claude.js      → structured JSON dialogue + chime
   ↓
[Play Ch. N]       js/tts.js + js/ui.js → two voices, karaoke transcript
   ↓
[Chime]            js/ui.js          → in-narrative transition (Host A previews
   ↓                                   paths, Host B riffs); options + free-text
   ↓                                   redirect; doing nothing takes the default
   ↓                                   path when the transition ends
   ↓  (loop until chapter target reached)
[Done]             full transcript + references + "start a new one"
```

The whole flow is coordinated by the state machine in [`js/app.js`](js/app.js).

## Running it

This is a static, dependency-free site. Any static file server works, e.g.:

```bash
# Python
python3 -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>, paste a Claude API key, type a topic, and
hit Start.

### About the API key

Chapter generation calls the Claude Messages API (`claude-sonnet-5`, direct
from the browser via the API's CORS opt-in header — Sonnet is plenty for
grounded, schema-constrained dialogue, and it's faster and cheaper per
chapter than Opus). Because a browser-only POC
has no server to hold a secret, you paste your own key on the setup screen —
it's kept in `localStorage` and sent only to `api.anthropic.com`. This is the
known rough edge called out in [`docs/spec.md`](docs/spec.md) §6; swapping in a
tiny backend proxy (and ElevenLabs) later is an infra task, not an
architecture change. Wikipedia and browser TTS need no key.

## Known rough edges (flag, don't fix — POC only)

- Wikipedia depth is capped; obscure topics produce thin chapters.
- Browser TTS voice quality/availability varies by OS and browser.
- No special handling for steering into a topic the extract doesn't support —
  the next chapter just does its best with what it has.

## License

[MIT](LICENSE)
