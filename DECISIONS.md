# DECISIONS — `seedance-video`

## 2026-09-09 — extracted from a channel repo, as a plugin rather than a skill install

Born inside `project-ai-channel-solution-before-vs-now`, where about a third of it was advice about
that channel — "Veo stays the default", a 1080x1920 deliverable, audio off because those prompts end
"no music, no speech". **That third is wrong advice in anyone else's repo**, so the extraction
stripped it rather than moving it. What travels is the engine: contract, presets, flags, price, traps.

**Plugin-only, not dual-channel.** The `npx skills` path was deliberately skipped. A plugin installs
once to the account and every repo picks it up on `cd`, which is the actual requirement, and it is
the form that ports to Claude Code on the web.

**Env-var auth for the same reason.** `OPENROUTER_API_KEY` and nothing else — machine-local config
does not travel to a cloud session, but environment config does.

## 2026-09-09 — a probe is a purchase, and it cost USD 1.17

POSTing `{model, prompt:"x", bogus_field_xyz:1}` to learn the schema **did not error**. Unknown
fields are ignored, so the request was valid and rendered: 1280x720, 24 fps, 5.04 s, audio on,
**USD 1.16523**. `DELETE /api/v1/videos/<id>` returns 404 — it could not be stopped.

**Decisions taken:**

- The skill teaches the schema from a written reference and never instructs probing the live API.
- Only two probe shapes are sanctioned because they error for free: an **invalid enum value** and a
  **malformed URL**.
- The script prints `[job] <id>` **before** the first poll, and `--job` re-downloads for free, so a
  crash is never a second charge.
- `--preflight` exists so a missing or unfunded key is caught before a render, not during one.

## 2026-09-09 — `GET /api/v1/models` hides every video model

It returns 431 models, none with video output. The obvious conclusion — "OpenRouter has no video" —
is wrong and was believed for four days. The real list is `GET /api/v1/videos/models`: **28 models**.

What settled it was calling the model id directly: `chat/completions` answered *"is a video
generation model and cannot be used with the chat/completions endpoint"*, proving the model existed
while the catalogue denied it. **A complete-looking list is not evidence of a complete list.**

## 2026-09-09 — the advertised price is not the price

Model page: "from USD 0.1028/second". Measured at 720p: **USD 0.2312/s** (USD 1.16523 ÷ 5.041667 s).
The advertised figure is the 480p floor. `RATES` carries both and the script **warns** when quoting
480p, because that tier has never been billed. Do not remove the warning until it has.

## 2026-09-09 — the skill leads with when NOT to use Seedance

Measured against Veo 3.1 fast it is roughly **twice the price for 44% of the pixels**, and it has no
1080p at all. A skill that only knew how to fire the API would get fired at every clip, so `SKILL.md`
and `README.md` both state the comparison up front and name length and frame control — 30 s in one
call, first/last-frame, references, seed — as the actual reasons to reach for it.

## 2026-09-09 — "Lightway" and "Wiregen" are not models

Both were asked for by name. Neither is in the 28-model video catalogue, in any spelling. The nearest
real name is Alibaba **Wan** (`alibaba/wan-2.6`, `wan-2.7`, `wan-3.0`, `wan-3.0-prime`). Recorded so
nobody hunts for them again.
