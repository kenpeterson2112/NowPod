# NowPod — POC Build Spec

**Status:** Ready to hand to Fable 5 for a one-shot build
**Scope:** Proof of concept only — Wikipedia + Wikinews as sources, light content depth, browser TTS as ElevenLabs stand-in

---

## 1. What this proves

Not "can an AI narrate an article." NotebookLM already does that. This POC proves the two things NotebookLM *doesn't* do:

1. **Chapters generate and play incrementally** instead of one long render-then-wait block.
2. **The listener can steer between chapters** via an in-narrative "chime" moment, without pausing or breaking the illusion of a live show.

Everything else (paid source partnerships, persona roster, ad breaks, Podscan integration) is deliberately out of scope for this build. Get the seam right first.

## 2. Non-goals for this build

- No real ElevenLabs integration (see §6 — use browser TTS instead)
- No paid/licensed sources (Wikipedia + Wikinews only)
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
[Chime] → in-narrative transition, not an explicit "please choose" callout
           (see §11 for the exact script pattern and UI treatment)
           → listener picks an option, types a custom redirect,
             or does nothing and it auto-continues when the transition ends
        ↓
   loop to [Generate Chapter N+1] until chapter count target reached
        ↓
[Done] → full transcript available, "start a new one" button
```

Critical UX rule: the chime is *never* a modal or a pause on the audio. It's a UI panel that appears alongside the transcript while the current chapter's transition is playing. The user can act on it or ignore it. See §11 — this needed a real redesign after early testing, both for the dialogue and for how noticeable the UI is.

## 4. Hardcoded persona (POC only)

Two hosts, not modeled on any real person:

- **Host A — "the Explainer":** grounds each topic, asks the obvious question a smart newcomer would ask
- **Host B — "the Enthusiast":** supplies the color, the "wait, that's wild" reactions, pushes for the next layer of depth

This pairing is deliberately generic and reusable — it's a placeholder for the eventual persona roster, not a design decision to preserve long-term.

## 5. Data flow / API calls

**Research (Wikipedia + Wikinews):**
- Wikipedia search: `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={topic}&format=json&origin=*`
- Wikipedia extract: `https://en.wikipedia.org/api/rest_v1/page/summary/{title}` for quick depth; for "deep dive," also pull `action=query&prop=extracts&explaintext&titles={title}&format=json&origin=*` for the fuller article body
- Wikinews search + extract: same MediaWiki API shape, just pointed at `en.wikinews.org` instead of `en.wikipedia.org` — `action=query&list=search&srsearch={topic}&format=json&origin=*`, then `action=query&prop=extracts&explaintext&titles={title}&format=json&origin=*`. Runs on the same software, same CORS-friendly `origin=*` pattern, no auth — genuinely low-risk to add.
- When to use which: run both searches, or pick Wikinews first for topics that read as current-events/news-shaped, Wikipedia first otherwise. If Wikinews returns no good match (most topics won't have news coverage), just fall back to Wikipedia-only — don't block on it.
- No auth needed for either source, CORS-friendly by design

**Script generation (Claude, via `/v1/messages`):**
- One call per chapter
- Input: Wikipedia extract, running summary of prior chapters, the listener's last steering choice (if any), depth setting
- Instruct the model to return **structured JSON only**: an array of `{speaker: "A"|"B", text: "..."}` dialogue lines, plus a `chime: {prompt: "...", options: ["...","...","..."]}` object
- The final 2-3 dialogue lines of each chapter are the chime — see §11 for the exact pattern the model should follow (Host A recaps and previews options, Host B riffs to buy the listener time). Don't generate a separate bolted-on "please choose" line; the transition is written as part of the script itself.
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
- [ ] Chime is woven into the chapter's closing dialogue as an in-character transition (Host A recaps + previews options, Host B riffs), not a bolted-on "please choose" line, and the UI signal for it is clearly noticeable — see §11
- [ ] Choosing an option or typing a redirect visibly changes the next chapter's content
- [ ] Doing nothing at the chime still auto-continues into the next chapter's default path
- [ ] Whole loop runs for 2–4 chapters without a hard error on a normal Wikipedia topic

## 8. Known rough edges to flag, not fix, in the POC

- Wikipedia depth is capped — obscure topics will produce thin chapters. Expected and fine for a POC.
- Browser TTS voice quality/availability varies by OS and browser. Expected and fine for a POC.
- No handling yet for a listener steering into a topic the Wikipedia extract doesn't support — chapter N+1 generation should just do its best with what it has.

## 9. Usage & monetization model (post-POC)

Core principle: **meter minutes, not episodes.** A 5-minute daily brief and a 40-minute deep dive are wildly different cost events even though they're both "one podcast" to the user. Minutes is the honest unit because it tracks TTS cost, which is the dominant variable expense.

**Free tier:**
- 100 audio-minutes/month, no separate cap on how many episodes that's split across
- Ad-supported — ad breaks slot into the existing chime seam (this is the same "in-narrative pause" mechanism, just monetized rather than purely for steering)
- Visible minutes-remaining meter shown before generation, so the cost tradeoff is legible ("this deep dive will use ~38 of your remaining 62 minutes") rather than a surprise after the fact
- Short-form formats (5-10 min briefs/recaps) are nearly free to serve even at high frequency — this tier should feel generous for daily-habit use, since that's the on-ramp to upgrading, not a cost risk

**Paid ramp — Plus / Premium / Pro:**
- Standard SaaS tiering, increasing in: monthly minute allotment, access to higher-quality TTS (ElevenLabs/PlayDialog-tier voices vs. the free tier's cheaper default engine), ad-free listening, and eventually access to licensed/paid sources (Britannica, National Geographic, etc.) once those deals exist
- Deep dives should draw down the bank faster than short-form content at every tier, not just free — this keeps a heavy deep-dive user from being effectively unlimited at a flat price
- Exact tier names/pricing TBD — not needed for the POC, just the minutes-bank mechanic and the meter UI

Why this shape works: it protects the expensive thing (long-form deep dives) which also happens to be the product's actual differentiator, while giving away the cheap thing (short daily use) generously, since that's what builds the habit that eventually converts.

## 10. Student mode (future track, not in POC scope)

A separate use case worth designing for early, even if built later: exam prep and lecture recap, tuned specifically for students rather than general curiosity.

Two format presets:

- **Exam prep (~10 min):** listened to on the way to a test. Tone shifts from "informative" to "active recall" — the chime mechanism gets repurposed from steering into light quizzing (host asks a question, listener answers or skips, host confirms/corrects). This is a natural extension of the chime UI already designed, not a new mechanism.
- **Lecture recap (~5 min):** a quick summary of a specific lecture or reading, listened to right after class. Shorter, denser, less conversational padding than the general "deep dive" format.

The harder problem is input, not output. Students' source material isn't Wikipedia-clean — it's syllabi, lecture slides, and journal articles (multi-column PDFs, footnotes, inconsistent citation formatting, scanned pages). This needs a real document-ingestion layer, not the simple Wikipedia-search-and-summary approach in the POC. That's a meaningfully bigger build than swapping a data source — treat it as its own research spike before committing to the format.

Business angle worth flagging: this maps naturally to a discounted student pricing tier (the Spotify/Apple Music playbook), and potentially a campus or institutional partnership channel — same shape as the source-licensing partnerships discussed earlier, but with schools or ed-content providers instead of publishers.

Scope note: this is a distinct enough problem (source parsing) and audience (students, not general listeners) that it's worth treating as its own follow-on spec once the core POC is validated, rather than folding into this build.

## 11. Chime redesign — in-narrative transition + visibility

Early testing surfaced two problems with the original chime: the callout ("let us know, or we'll carry on") read as forced and broke the show's voice, and the UI itself was too subtle — easy to miss entirely.

**The dialogue pattern (replaces the old explicit callout):**

- **Host A recaps and previews, in-character, not as a menu:** summarizes what the chapter just covered, then names the natural next options — a default path, and a second, more complex thread that would normally come later if not chosen now — and teases a third thing that didn't get covered at all. This is written as a real sentence a host would say, not a labeled list.
- **Host B riffs for ~10-15 seconds:** reacts to one of the options, maybe admits it was the concept they personally found hardest to grasp at first, or picks a favorite. This isn't filler — it's the buffer that gives the listener time to glance at their phone and tap an option if they want to, without the show ever going silent or sounding like it's waiting on them.
- If the listener does nothing, the next chapter just picks the default path Host A named. No dead air, no "waiting for input" state.

**UI visibility fix:** the chime panel needs a clearer visual signal than the current build gives it — options include a brief animated pulse/glow on appearance, a distinct (non-alarming) sound cue separate from the ambient show audio, or a persistent-but-quiet indicator (e.g. a small badge) that stays visible for the whole riff window rather than only flashing once. Exact treatment is a design pass, not specified further here — the requirement is just "noticeable without being alarming."

Open design question, not resolved here: how overt this should be is genuinely a taste question — there's a real case that some noticeable friction is a feature, not a flaw, since it's the moment the show is explicitly inviting participation. Worth listener testing rather than guessing.

Roadmap item (not in POC scope): a **"transitional friction" slider.** Let the user tune how overt this moment is — from fully ambient (barely-there indicator, pure riff-as-buffer) to fully explicit (Host A directly addresses the listener, longer pause, stronger visual callout). This is a nice one to have on the roadmap specifically because it signals the product cares about this exact texture of the experience, not just the mechanics of it.

## 12. Disclaimer & reference list

- Disclaimer, persistent but unobtrusive (footer of setup and player screens, not a modal): "NowPod uses AI and can make mistakes. Double-check anything important, and check the reference list before citing this."
- Reference list, auto-populated per episode (ideally per chapter, since a steered episode may span multiple source articles) from the actual Wikipedia/Wikinews article titles and URLs fetched for that content — not a generic "we use Wikipedia" note. URLs are derivable directly from the title already returned by the research call (`https://en.wikipedia.org/wiki/{title}`, spaces → underscores; same pattern for `en.wikinews.org`), so this needs no new API calls.
