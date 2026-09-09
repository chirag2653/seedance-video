# seedance-video

A Claude Code plugin that makes an agent expert at **ByteDance Seedance 2.5** through
**OpenRouter's Video API** — so it generates video from knowledge instead of guessing at an
undocumented endpoint and paying for the lesson.

Works in any repo. The only prerequisite is an `OPENROUTER_API_KEY` in the environment.

## Install

```
/plugin marketplace add chirag2653/claude-code-personal-toolkit
/plugin install seedance-video@claude-code-personal-toolkit
```

Then set the key once:

| where | how |
|---|---|
| Windows | `setx OPENROUTER_API_KEY "sk-or-v1-..."` then **start a new shell** |
| macOS / Linux | `export OPENROUTER_API_KEY="sk-or-v1-..."` in your shell profile |
| Claude Code on the web | set it in the environment config |

Get a key at https://openrouter.ai/settings/keys. Verify with:

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/seedance-video/scripts/seedance.mjs" --preflight
# preflight: OK   credits remaining USD 32.42   model bytedance/seedance-2.5
```

Requires **Node 18+**. Zero dependencies.

## Use it

Ask in plain language — "generate a vertical 8-second clip of X with Seedance" — and the agent
resolves the script, preflights, prices the call and renders. Under the hood it is one line:

```bash
node "$SCRIPT" --preset shorts-beat --prompt idea.txt --out out.mp4
```

Eight presets cover the common shapes:

| preset | shape | length | cost |
|---|---|---|---|
| `shorts-beat` | 720p 9:16 | 8 s | USD 1.85 |
| `shorts-rehearse` | 480p 9:16 | 8 s | USD 0.82 |
| `shorts-probe` | 480p 9:16 | 4 s | USD 0.41 |
| `shorts-long` | 720p 9:16 | 30 s | USD 6.94 |
| `youtube` | 720p 16:9 | 8 s | USD 1.85 |
| `youtube-long` | 720p 16:9 | 30 s | USD 6.94 |
| `square` | 720p 1:1 | 8 s | USD 1.85 |
| `cinematic` | 720p 21:9 | 8 s | USD 1.85 |

Any explicit flag overrides a preset. Full control is there when you want it: `--duration 4..30`,
`--res`, `--aspect`, `--size`, `--seed`, `--first-frame`, `--last-frame`, `--ref` (repeatable),
`--audio`, `--callback`, `--provider`.

## Why it exists

Seedance 2.5 through OpenRouter is easy to get wrong in expensive ways. This plugin encodes what it
cost to find out:

- **`GET /api/v1/models` hides every video model.** It returns 431 text models and nothing else, so
  the obvious conclusion — "OpenRouter has no video" — is wrong. The real list is
  `GET /api/v1/videos/models`: 28 models.
- **The submit schema is permissive, so a probe is a purchase.** `{model, prompt}` alone renders;
  unknown fields are ignored rather than rejected. Poking the endpoint to learn the schema bills you.
- **There is no cancel.** `DELETE` returns 404. The script therefore prints the job id *before*
  polling, and `--job <id>` re-downloads a finished render for free.
- **The advertised price is the 480p floor.** "From USD 0.1028/second" is not what you pay; 720p
  measured at **USD 0.2312/second**.
- **There is no 1080p and no 4K.** The tallest vertical is `720x1280`. The script refuses
  `--res 1080p` rather than letting the API quietly downgrade it.

## What it is good for, and what it is not

| | Seedance 2.5 | Google Veo 3.1 fast |
|---|---|---|
| tallest vertical | 720x1280 | 1080x1920 |
| USD per second | 0.2312 (720p, measured) | 0.12 (1080p) |
| an 8-second clip | USD 1.85 | USD 0.96 |
| longest single call | **30 s** | 8 s |

Roughly twice the price for 44 percent of the pixels. **Reach for Seedance when you need length or
frame control** — 30 seconds in one unbroken take, first/last-frame continuity, reference images, or
a seed. For raw resolution per rupee, another engine wins. The skill leads with this, so an agent
does not reach for it by reflex.

## What's inside

```
.claude-plugin/plugin.json
skills/seedance-video/
  SKILL.md                     # presets, flags, shapes, input modes, the four money traps
  reference/scale.md           # which call for which job — recipes and batch rules
  reference/api-contract.md    # the raw endpoint: fields, statuses, errors, measured defaults
  scripts/seedance.mjs         # zero-dep Node renderer: preflight, price, submit, poll, recover
```

## Licence

MIT.
