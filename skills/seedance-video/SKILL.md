---
name: seedance-video
description: >-
  Generate video with ByteDance Seedance 2.5 through OpenRouter's Video API — named presets for
  every common shape, the full flag surface, the measured price, and the traps that cost real
  money. Use when the ask is Seedance (also heard as "Sidens" or "Seedream"), OpenRouter video
  generation, text-to-video, image-to-video, first-frame or last-frame conditioning, reference
  images for character or style consistency, a clip longer than 8 seconds, vertical Shorts or
  Reels footage, or comparing Seedance against Veo, Sora, Kling or Wan. Needs only an
  OPENROUTER_API_KEY in the environment and Node 18+; it checks for the key first and explains how
  to set one on Windows, macOS, Linux or Claude Code on the web. Knows what the model cannot do —
  there is no 1080p and no 4K — and knows that the submit schema is permissive enough that a
  careless probe becomes a paid render that cannot be cancelled.
version: 1.0.0
---

# Seedance 2.5 on OpenRouter

**Two commands is the whole happy path.** Check the machine can spend, then spend.

```bash
node "$SCRIPT" --preflight                                              # free
node "$SCRIPT" --preset shorts-beat --prompt idea.txt --out out.mp4     # USD 1.85
```

## Script location — resolve once, then reuse

This ships as a Claude Code plugin, so the script lives under the plugin root:

```bash
dir="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/skills/seedance-video}"
[ -d "$dir" ] || dir=$(ls -d "$HOME"/.claude/plugins/cache/*/seedance-video/*/skills/seedance-video 2>/dev/null | head -1)
[ -d "$dir" ] || dir="$HOME/.agents/skills/seedance-video"
[ -f "$dir/scripts/seedance.mjs" ] || { echo "seedance-video not installed. /plugin install seedance-video@claude-code-personal-toolkit"; exit 1; }
SCRIPT="$dir/scripts/seedance.mjs"
```

⚠️ **The plugin cache inserts a commit-SHA directory**, so the installed path is
`~/.claude/plugins/cache/<marketplace>/seedance-video/<sha>/skills/seedance-video/`. That is what
`CLAUDE_PLUGIN_ROOT` points at, and it is why line 2 globs past the SHA when the variable is not set
— a plain `$HOME/.agents/...` fallback resolves to nothing and fails later with an unhelpful
`MODULE_NOT_FOUND`. The last line makes a miss say so immediately.

Requires **Node 18+** (uses built-in `fetch`). Zero dependencies — nothing to install.

## Step 0 — the key, the one thing this skill cannot self-provide

```bash
node "$SCRIPT" --preflight          # or --preflight --json for a parseable result
```

`preflight: OK   credits remaining USD 32.42` means go. Anything else stops you before a failed
render. If it reports **NO KEY**, get one at https://openrouter.ai/settings/keys and set it in the
environment — the script prints the exact command for the platform:

| where | how |
|---|---|
| Windows | `setx OPENROUTER_API_KEY "sk-or-v1-..."` then **start a new shell** — `setx` never affects the shell you ran it in |
| macOS / Linux | `export OPENROUTER_API_KEY="sk-or-v1-..."`, added to the shell profile |
| Claude Code on the web | set it in the environment config; nothing machine-local travels to a cloud session |

Ask the user for the key rather than inventing a workaround. There is no other auth path.

## The presets — this is the interface

```bash
node "$SCRIPT" --preset <name> --prompt <file.txt> --out <file.mp4>
```

| preset | shape | length | cost |
|---|---|---|---|
| **`shorts-beat`** | 720p 9:16 | 8 s | USD 1.85 |
| `shorts-rehearse` | 480p 9:16 | 8 s | USD 0.82 |
| `shorts-probe` | 480p 9:16 | 4 s | USD 0.41 |
| `shorts-long` | 720p 9:16 | 30 s | USD 6.94 |
| `youtube` | 720p 16:9 | 8 s | USD 1.85 |
| `youtube-long` | 720p 16:9 | 30 s | USD 6.94 |
| `square` | 720p 1:1 | 8 s | USD 1.85 |
| `cinematic` | 720p 21:9 | 8 s | USD 1.85 |

Presets set **audio off** — a generated voice is usually a defect, and most pipelines score their
own sound. Pass `--audio` to keep the model's. **Any explicit flag overrides the preset**, so
`--preset shorts-beat --duration 12` is a 12-second beat.

**`--list-presets`, `--preflight` and `--price-only` are all free.** Of the three, only
`--preflight` needs a key — the other two work on a machine that has never seen one, so a session
can budget before anyone hands it credentials.

**[`reference/scale.md`](reference/scale.md) is the operating manual** — which preset for which job,
how to add frame and reference control, the end-to-end recipes, and the rules that stop a batch
becoming a bill. **Read it before spending.** The raw endpoint is
[`reference/api-contract.md`](reference/api-contract.md).

## The four things that cost money

1. ⚠️ **The submit schema is PERMISSIVE, so a probe is a purchase.** `{model, prompt}` alone is
   accepted and immediately renders; unknown fields are *ignored*, not rejected. Poking the live
   endpoint to "see what the schema says" does not error — it bills. Measured: USD 1.17 for exactly
   that mistake. Learn the schema from this skill. If you must probe, an invalid **enum value** or a
   malformed **URL** errors for free; an unknown **field** does not.
2. ⚠️ **There is no cancel.** `DELETE /api/v1/videos/<id>` returns 404. Once submit returns, the
   money is committed. This is why the script prints `[job] <id>` *before* polling — a crashed
   process is recovered with `--job`, never re-submitted.
3. ⚠️ **There is no 1080p and no 4K.** `resolution` is `480p` or `720p`; the tallest vertical is
   `720x1280`. If the deliverable is 1080p or above, this model cannot produce it — the script
   refuses `--res 1080p` rather than letting the API silently downgrade.
4. ⚠️ **The advertised price is the 480p floor.** The model page says "from USD 0.1028/second".
   **Measured at 720p: USD 0.2312/second** (USD 1.16523 for 5.041667 s at 1280x720). Budget from the
   measured rate; the script warns whenever it quotes the unverified 480p one.

## Every flag

| flag | does |
|---|---|
| `--preflight` | is the key set, valid, and funded. **Free.** Add `--json` to parse it |
| `--list-presets` | print the preset table. **Free**, no key needed |
| `--price-only` | print the estimate and exit. **Free**, no key needed |
| `--preset <name>` | shape, length and audio in one flag |
| `--prompt <file>` | the prompt, read from a file (required unless a frame image is given) |
| `--out <file.mp4>` | where the render lands |
| `--duration N` | 4–30 whole seconds |
| `--res 480p\|720p` | resolution tier. There is no 1080p |
| `--aspect <r>` | `16:9` `4:3` `1:1` `3:4` `9:16` `21:9` |
| `--size WxH` | exact dimensions instead of res+aspect; refuses to combine with them |
| `--audio` / `--no-audio` | audio is on at the API default, off in every preset |
| `--seed N` | reproducibility — not guaranteed, verify before relying on it |
| `--first-frame <url>` | condition the opening frame |
| `--last-frame <url>` | condition the closing frame |
| `--ref <url>` | reference image for subject/style, repeatable |
| `--callback <url>` | https webhook instead of polling |
| `--provider <json>` | OpenRouter routing preferences |
| `--job <id>` | recover a paid render. **Free**, never re-charges |
| `--index N` | which clip to download when a job made several |

## The shapes

Six aspect ratios, two tiers each. `--aspect` + `--res`, or `--size` for exact pixels.

| shape | 480p | 720p | typical use |
|---|---|---|---|
| 9:16 | `480x854` | `720x1280` | Shorts, Reels, TikTok |
| 16:9 | `854x480` | `1280x720` | horizontal YouTube |
| 1:1 | `640x640` | `960x960` | square social |
| 4:3 | `752x560` | `1112x834` | period or archival framing |
| 3:4 | `560x752` | `834x1112` | portrait |
| 21:9 | `992x432` | `1470x630` | cinematic insert |

## Input modes

| mode | flags |
|---|---|
| text only | `--prompt <file>` |
| text + references | `--prompt` + `--ref <url>` (repeatable) |
| text + opening frame | `--prompt` + `--first-frame <url>` |
| text + closing frame | `--prompt` + `--last-frame <url>` |
| text + both frames | `--first-frame` + `--last-frame` — brackets a move |
| frames without a prompt | `--first-frame` alone; the prompt becomes optional |
| reproducible | any of the above + `--seed N` |

⚠️ Images must be **https URLs or base64 data URLs reachable by OpenRouter** — a local file path
will not work. A local-first pipeline needs an upload step first.

⚠️ `--ref` has **no cap in the submit schema** (50 were accepted). The provider refuses *after*
acceptance, which is billable. Keep it to a handful.

⚠️ `--seed` determinism is **not guaranteed per provider**. Render the same seed twice and compare
before trusting it.

## How it compares

Measured, not claimed. Seedance is **not** a cheaper or sharper general-purpose engine:

| | Seedance 2.5 | Google Veo 3.1 fast |
|---|---|---|
| tallest vertical | 720x1280 | 1080x1920 |
| USD per second | 0.2312 (720p, measured) | 0.12 (1080p) |
| an 8-second clip | USD 1.85 | USD 0.96 |
| longest single call | **30 s** | 8 s |

Roughly twice the price for 44 percent of the pixels. **Reach for Seedance when you need length or
frame control** — 30 seconds in one unbroken take, `first_frame`/`last_frame` continuity,
`input_references`, or a `seed`. For raw resolution per rupee, another engine wins.

## Noise to ignore

- **"OpenRouter has no video models."** It has 28. `GET /api/v1/models` **hides them** — it returns
  431 text models and nothing else. Use `GET /api/v1/videos/models`, or
  `/api/v1/models?output_modality=video`. This single quirk is the most common wrong conclusion.
- **Model ids that do not exist:** `seedance-2.2.5`, `sidens-2.5`, `seedance-1.0-pro`. The real
  family is `bytedance/seedance-2.5`, `-2.0`, `-2.0-fast`, `-2.0-mini`, `bytedance/seedance-1-5-pro`.
- **`/api/v1/chat/completions` does not serve video.** It returns 400 telling you to use `/videos`.
- **The wide resolution enum** (`768p`, `1080p`, `1K`, `2K`, `4K`) belongs to the shared endpoint
  schema across all 28 models. Seedance 2.5 accepts only `480p` and `720p`, and a value it does not
  support is refused *downstream, after acceptance*.
