# scale.md — which call, for which job

**Read this once and you can fire any call from a single line.** Every common shape is a named
preset; the long-form flags are underneath for what a preset does not cover.

`--preflight`, `--list-presets` and `--price-only` are free. **Everything else on this page spends
money the moment it returns, and there is no cancel.**

```bash
dir="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/skills/seedance-video}"
[ -d "$dir" ] || dir=$(ls -d "$HOME"/.claude/plugins/cache/*/seedance-video/*/skills/seedance-video 2>/dev/null | head -1)
[ -d "$dir" ] || dir="$HOME/.agents/skills/seedance-video"
SCRIPT="$dir/scripts/seedance.mjs"
```

## 1. The presets

```bash
node "$SCRIPT" --preset <name> --prompt <file.txt> --out <file.mp4>
```

| preset | shape | length | cost | use it for |
|---|---|---|---|---|
| **`shorts-beat`** | 720p 9:16 | 8 s | USD 1.85 | **the default vertical beat.** Shorts, Reels, TikTok |
| `shorts-rehearse` | 480p 9:16 | 8 s | USD 0.82 | a cheap look at a risky prompt before paying full |
| `shorts-probe` | 480p 9:16 | 4 s | USD 0.41 | the cheapest render there is — does the idea read at all |
| `shorts-long` | 720p 9:16 | 30 s | USD 6.94 | a continuous take no cut can fake |
| `youtube` | 720p 16:9 | 8 s | USD 1.85 | horizontal YouTube, a landscape cutaway |
| `youtube-long` | 720p 16:9 | 30 s | USD 6.94 | a horizontal one-take |
| `square` | 720p 1:1 | 8 s | USD 1.85 | square social (960x960) |
| `cinematic` | 720p 21:9 | 8 s | USD 1.85 | a letterboxed insert (1470x630) |

Every preset sets **audio off**. Pass `--audio` to keep the model's sound.

```bash
node "$SCRIPT" --list-presets                      # the table, from the source of truth. Free
node "$SCRIPT" --preset shorts-beat --price-only   # confirm the spend. Free
```

**Any explicit flag overrides the preset**, so `--preset shorts-beat --duration 12` is a 12-second
beat at USD 2.77. Start from a preset and adjust one thing rather than spelling out six flags.

## 2. Adding control to a preset

The preset fixes shape, length and audio. It does not fix how much the images control the frame —
compose these onto any preset:

| you want | add |
|---|---|
| text alone decides the shot | *(nothing — the default)* |
| the clip opens on an exact image | `--first-frame <url>` |
| the clip lands on an exact image | `--last-frame <url>` |
| a clip that continues the previous one | `--first-frame <the previous clip's last frame>` |
| a move bracketed end to end | `--first-frame <url> --last-frame <url>` |
| a subject or style carried across clips | `--ref <url>` (repeatable) |
| the shot re-renderable identically | `--seed 12345` |

⚠️ Images must be **https URLs or base64 data URLs reachable by OpenRouter**. A local path will not
work — this is the one place a local-first pipeline needs an upload step first.

⚠️ `--seed` determinism is **not guaranteed per provider**. Render the same seed twice and compare
before relying on it.

⚠️ `--ref` has **no cap in the submit schema** (50 were accepted without complaint), so the schema
will not protect you. The provider refuses *after* acceptance, which is billable. Keep it small.

## 3. The recipes, end to end

```bash
# Always first. Free.
node "$SCRIPT" --preflight

# Rehearse cheap, carrying the seed you will reuse.
node "$SCRIPT" --preset shorts-rehearse --seed 4242 --prompt beat-1.txt --out work/rehearse-1.mp4

# The keeper, same seed.
node "$SCRIPT" --preset shorts-beat --seed 4242 --prompt beat-1.txt --out raw/beat-1.mp4

# Clip 2 continuing from clip 1's final frame.
node "$SCRIPT" --preset shorts-beat --first-frame https://example.com/beat-1-last.png \
  --prompt beat-2.txt --out raw/beat-2.mp4

# A subject carried across clips.
node "$SCRIPT" --preset shorts-beat --ref https://example.com/character.png \
  --prompt beat-3.txt --out raw/beat-3.mp4

# A long continuous take — costs more than three 8-second clips.
node "$SCRIPT" --preset shorts-long --prompt oner.txt --out raw/oner.mp4

# Horizontal.
node "$SCRIPT" --preset youtube --prompt wide.txt --out raw/wide.mp4

# Recover a render already paid for. Free, never re-charges.
node "$SCRIPT" --job <id> --out raw/beat-1.mp4
```

## 4. When a preset is not enough

| you need | flag |
|---|---|
| exact pixels rather than a tier | `--size 720x1280` (refuses to combine with `--res`/`--aspect`) |
| a length no preset has | `--duration N`, whole number 4–30 |
| a webhook instead of polling | `--callback <https url>` |
| OpenRouter routing preferences | `--provider '<json>'` |
| a second clip from a multi-clip job | `--index N` on the `--job` recovery |

Every aspect ratio, both tiers, exact pixels:

| shape | 480p | 720p |
|---|---|---|
| 9:16 | `480x854` | `720x1280` |
| 16:9 | `854x480` | `1280x720` |
| 1:1 | `640x640` | `960x960` |
| 4:3 | `752x560` | `1112x834` |
| 3:4 | `560x752` | `834x1112` |
| 21:9 | `992x432` | `1470x630` |

⚠️ **Nothing here reaches 1080p.** `720x1280` is the tallest vertical the model makes. A pipeline
that ships 1080p or above must upscale, reframe, or use another engine.

⚠️ The 480p rate is **advertised, never measured** — the script warns whenever it quotes one. Treat
a 480p estimate as soft until a 480p job has a real `usage.cost` against it.

## 5. Scaling up — the rules that stop a batch becoming a bill

- **Preflight, then price the whole batch before the first render.** `--price-only` per clip, add it
  up, say the total out loud. Four 720p clips is USD 7.40.
- **Render one, look at it, then render the rest.** A paid render returning 200 is not evidence the
  frame is right. Contact-sheet the first —
  `ffmpeg -i <mp4> -vf "fps=1,scale=360:-1,tile=4x2" -frames:v 1 sheet.png` — before committing the
  rest of the money.
- **Never parallelise blind.** There is no cancel. Ten concurrent submits are ten committed charges,
  and a bad prompt found on the first cannot stop the other nine.
- **Keep every job id.** The script prints `[job] <id>` before polling precisely so a crash costs
  nothing. Re-submitting because a download failed is paying twice for one render.
- **A 429 for depleted credits is a STOP, never a retry.** `--preflight` reports remaining credits;
  run it before a large batch.

## 6. When not to use Seedance at all

- **Anything shipping at 1080p or above.** There is no 1080p tier. Use another engine.
- **Anything where cost per usable second matters more than length or control.** Veo 3.1 fast is
  USD 0.12/s at 1080p against Seedance's measured USD 0.2312/s at 720p — roughly twice the price for
  44 percent of the pixels.
- **Footage that must read as genuinely archival or documentary.** A generated shot wearing the
  costume of real footage is a deception, not a style. Source it instead.
