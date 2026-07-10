# Bespoke Podcast Generator — POC Build Spec

**Status:** Ready to hand to Fable 5 for a one-shot build
**Scope:** Proof of concept only — Wikipedia as sole source, light content depth, browser TTS as ElevenLabs stand-in

---

## 1. What this proves

Not "can an AI narrate an article." NotebookLM already does that. This POC proves the two things NotebookLM *doesn't* do:

1. **Chapters generate and play incrementally** instead of one long render-then-wait block.
2. **The listener can steer between chapters** via an in-narrative "chime" moment, without pausing or breaking the illusion of a live show.

Everything else (paid source partnerships, persona roster, ad breaks, Podscan integration) is deliberately out of scope for this build. Get the seam right first.

## 2. Non-goals for this build

- No real ElevenLabs integration (see §6 — use browser TTS instead)
- No paid/licensed sources (Wikipedia only)
- No user accounts, saved history, or persistence
- No persona roster — hardcode one host pairing (see §4)
- No ad breaks

## 3. User flow

```
[Setup screen]
  topic (text input)
  depth: "quick" | "deep dive"      → controls chapter count target (2 vs 4)
  → Start
        ↓
[Research] fetch Wikipedia summary + extract for topic
        ↓
[Generate Chapter N] → Claude writes dialogue script for chapter N,
                        grounded in the Wikipedia extract + prior chapter
                        summaries + any steering input from the listener
        ↓
[Play Chapter N] → browser TTS reads dialogue aloud, alternating two
                    voices, transcript highlights the active line
        ↓
[Chime] → host in-narrative says "next we could cover X, Y, or Z —
           let us know, or we'll just carry on"
           → listener picks an option, types a custom redirect,
             or does nothing and it auto-continues after a short pause
        ↓
   loop to [Generate Chapter N+1] until chapter count target reached
        ↓
[Done] → full transcript available, "start a new one" button
```

Critical UX rule: the chime is *never* a modal or a pause on the audio. It's a UI panel that appears alongside the transcript while the current chapter's audio is still finishing. The user can act on it or ignore it.

## 4. Hardcoded persona (POC only)

Two hosts, not modeled on any real person:

- **Host A — "the Explainer":** grounds each topic, asks the obvious question a smart newcomer would ask
- **Host B — "the Enthusiast":** supplies the color, the "wait, that's wild" reactions, pushes for the next layer of depth

This pairing is deliberately generic and reusable — it's a placeholder for the eventual persona roster, not a design decision to preserve long-term.

## 5. Data flow / API calls

**Research (Wikipedia):**
- Search: `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={topic}&format=json&origin=*`
- Extract: `https://en.wikipedia.org/api/rest_v1/page/summary/{title}` for quick depth; for "deep dive," also pull `action=query&prop=extracts&explaintext&titles={title}&format=json&origin=*` for the fuller article body
- No auth needed, CORS-friendly by design

**Script generation (Claude, via `/v1/messages`):**
- One call per chapter
- Input: Wikipedia extract, running summary of prior chapters, the listener's last steering choice (if any), depth setting
- Instruct the model to return **structured JSON only**: an array of `{speaker: "A"|"B", text: "..."}` dialogue lines, plus a `chime: {prompt: "...", options: ["...","...","..."]}` object
- Keep chapters short by design (roughly 6–10 exchanges) — this is the "light content" the POC calls for, and it keeps each generation call fast

**Voice (browser TTS, not ElevenLabs):**
- Use the Web Speech API (`speechSynthesis`), free and built into the browser, no key required
- Pick two distinct voices from `speechSynthesis.getVoices()` (fall back to pitch/rate variation if only one voice is available) and assign one per host
- Queue utterances line by line; highlight the active line in the transcript as it's spoken (basic karaoke effect)

## 6. Why browser TTS instead of ElevenLabs for this build

ElevenLabs (or any paid TTS API) needs a securely held API key and a server to call it from — that's a real cost and a real backend, not a POC concern. Browser TTS is free, needs no key, and is good enough to prove the *mechanics* (chapter pacing, chime steering, two-voice alternation). Swapping in ElevenLabs later is a backend/infra task, not an architecture change — the chapter/script/chime structure doesn't need to know or care which voice engine renders it.

## 7. Definition of done for the POC

- [ ] User can type any topic and get a Wikipedia-grounded chapter within a few seconds
- [ ] Audio plays automatically, alternating two distinct-sounding voices
- [ ] Transcript is visible and highlights the current line
- [ ] Chime appears before the current chapter's audio ends, with 2–3 options plus a free-text redirect field
- [ ] Choosing an option or typing a redirect visibly changes the next chapter's content
- [ ] Doing nothing at the chime still auto-continues into the next chapter
- [ ] Whole loop runs for 2–4 chapters without a hard error on a normal Wikipedia topic

## 8. Known rough edges to flag, not fix, in the POC

- Wikipedia depth is capped — obscure topics will produce thin chapters. Expected and fine for a POC.
- Browser TTS voice quality/availability varies by OS and browser. Expected and fine for a POC.
- No handling yet for a listener steering into a topic the Wikipedia extract doesn't support — chapter N+1 generation should just do its best with what it has.
