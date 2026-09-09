# OpenRouter Video API — the contract for `bytedance/seedance-2.5`

Everything here was either read from OpenRouter's canonical `llms.txt` for the model or measured
against the live endpoint on 2026-09-09. Where the two disagreed, the measurement wins and says so.

Canonical vendor doc: https://openrouter.ai/bytedance/seedance-2.5/llms.txt
Model page: https://openrouter.ai/bytedance/seedance-2.5

## Auth

`Authorization: Bearer $OPENROUTER_API_KEY` on every request, including the content download.
`Content-Type: application/json` on the submit.

## Discovery

| call | returns |
|---|---|
| `GET /api/v1/videos/models` | the 28 video models — the right list |
| `GET /api/v1/models?output_modality=video` | the same 28, via the general catalogue |
| `GET /api/v1/models` | 431 models, **none of them video** — this is what misled us |
| `GET /api/v1/models/bytedance/seedance-2.5/endpoints` | provider + pricing, but pricing reads `0/0` for video; it is not token-priced |
| `GET /api/v1/key` | key validity and usage | 
| `GET /api/v1/credits` | `total_credits` and `total_usage` for the account |

## Submit

`POST https://openrouter.ai/api/v1/videos` → `202`

```json
{
  "model": "bytedance/seedance-2.5",
  "prompt": "a slow push-in on a workshop bench, dust in the light, no music, no speech",
  "duration": 8,
  "resolution": "720p",
  "aspect_ratio": "9:16",
  "generate_audio": false,
  "seed": 12345
}
```

Response:

```json
{ "id": "zh7g...", "generation_id": "gen-vid-...", "polling_url": "/api/v1/videos/zh7g...", "status": "pending" }
```

⚠️ **The schema is permissive.** Unknown fields are ignored, not rejected, and `{model, prompt}`
alone is a complete, billable request. Invalid *enum values* and malformed *URLs* do error for free
— those are the only safe probes.

## Fields

| field | required | values |
|---|---|---|
| `model` | yes | `bytedance/seedance-2.5` |
| `prompt` | unless `frame_images` is set | free text |
| `duration` | no | whole number, 4–30 (seconds). Must be a **number**, not a string |
| `resolution` | no | `480p` \| `720p` — **this model has no 1080p** |
| `size` | no | `854x480` `752x560` `640x640` `560x752` `480x854` `992x432` `1280x720` `1112x834` `960x960` `834x1112` `720x1280` `1470x630` |
| `aspect_ratio` | no | `16:9` `4:3` `1:1` `3:4` `9:16` `21:9` |
| `frame_images` | no | array of `{type:"image_url", image_url:{url}, frame_type:"first_frame"\|"last_frame"}` |
| `input_references` | no | array of `{type:"image_url", image_url:{url}}` — no schema cap; provider-enforced |
| `generate_audio` | no | boolean |
| `seed` | no | integer; determinism not guaranteed per provider |
| `callback_url` | no | https webhook, instead of polling |
| `provider` | no | routing preferences, accepted on every request |

`size` is interchangeable with `resolution` + `aspect_ratio`. URLs may be https or base64 data URLs.

The **shared** `/videos` schema across all 28 models accepts `resolution` of
`480p|720p|768p|1080p|1K|2K|4K` and nine aspect ratios. **Do not copy that** — it is wider than what
Seedance 2.5 serves, and a value it does not support is refused downstream, after acceptance.

## Poll

`GET https://openrouter.ai/api/v1/videos/{id}` while `status` is `pending` or `in_progress`.
Terminal values: `completed`, `failed`, `cancelled`, `expired`.

```json
{ "id": "zh7g...", "status": "completed",
  "unsigned_urls": ["https://openrouter.ai/api/v1/videos/zh7g.../content?index=0"],
  "usage": { "cost": 1.16523, "is_byok": false } }
```

`usage.cost` is the USD actually charged — the only number to trust. Observed latency for a 5-second
720p render: about 75 seconds.

There is **no cancel**: `DELETE /api/v1/videos/{id}` returns 404.

## Download

`GET https://openrouter.ai/api/v1/videos/{id}/content?index=N` with the auth header. `index` selects
a clip when a job produced more than one. Re-downloading a finished job is **free** — recovery never
re-charges.

## Errors

`{"error": {"code": <number>, "message": <string>}}`, with schema violations arriving instead as
`{"success": false, "error": {"name": "ZodError", "message": "<json>"}}`.

| code | meaning |
|---|---|
| 400 | malformed request or an unsupported parameter value |
| 401 | missing or invalid API key |
| 402 | insufficient credits |
| 403 | spend limit reached, key disabled, or access blocked |
| 404 | unknown model, unknown job, or no provider can serve it |
| 429 | rate limited — back off |
| 502 | failed upstream; **failed generations are not billed** |

A job that fails *after* acceptance reports `status: "failed"` with an `error` message rather than an
HTTP error, because the submit already succeeded.

## Measured defaults

Submitting `{model, prompt}` with nothing else produced: **1280x720, 16:9, 24 fps, 5.041667 s, H.264
video with AAC stereo audio at 32 kHz, 7.9 MB, USD 1.16523.** So the defaults are 720p / 16:9 / ~5 s
with **audio on** — rarely what a vertical or silent pipeline wants. Always pass
`duration`, `resolution`, `aspect_ratio` and `generate_audio` explicitly.
