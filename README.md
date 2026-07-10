# NowPod — Bespoke Podcast Generator (POC)

An experimental proof of concept for a **bespoke, steerable podcast generator**.
You type a topic; two AI hosts research it on Wikipedia and narrate it to you as
a live-feeling show — generated **chapter by chapter** so audio starts fast, and
**steerable mid-show** through an in-narrative "chime" moment.

> **Status:** Scaffolding only. This repo currently contains the file structure,
> module boundaries, and stubs. The real implementation has not been written yet.

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
- No paid/licensed sources — Wikipedia only.
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
[Research]          js/wikipedia.js   → Wikipedia summary + extract
   ↓
[Generate Ch. N]   js/claude.js      → structured JSON dialogue + chime
   ↓
[Play Ch. N]       js/tts.js + js/ui.js → two voices, karaoke transcript
   ↓
[Chime]            js/ui.js          → options + free-text redirect (non-blocking)
   ↓  (loop until chapter target reached)
[Done]             full transcript + "start a new one"
```

The whole flow is coordinated by the state machine in [`js/app.js`](js/app.js).

## Running it (once implemented)

This is a static, dependency-free site. Any static file server works, e.g.:

```bash
# Python
python3 -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>.

> **Note:** Chapter generation calls the Claude Messages API, which requires an
> API key. For a browser-only POC this is a known rough edge — see
> [`docs/spec.md`](docs/spec.md) §6 and the TODOs in `js/claude.js`. Wikipedia
> and browser TTS need no key.

## Known rough edges (flag, don't fix — POC only)

- Wikipedia depth is capped; obscure topics produce thin chapters.
- Browser TTS voice quality/availability varies by OS and browser.
- No special handling for steering into a topic the extract doesn't support —
  the next chapter just does its best with what it has.

## License

[MIT](LICENSE)
