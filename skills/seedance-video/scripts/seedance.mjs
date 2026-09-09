#!/usr/bin/env node
// Zero-dep Seedance 2.5 renderer for OpenRouter's Video API.
// Priced before it spends, the job id printed before polling, and --job re-downloads a finished
// render for free — so a crash or a failed write is never a second charge.
//
// MEASURED 2026-09-09, not theorised — the whole reason this file exists:
//   * The submit schema is PERMISSIVE. {model, prompt} alone is accepted and LAUNCHES A PAID JOB;
//     unknown fields are ignored rather than rejected. A "probe" is a purchase. Cost us USD 1.17.
//   * There is NO cancel. DELETE /api/v1/videos/<id> returns 404. An accepted job is committed spend.
//   * Seedance 2.5 tops out at 720p (720x1280 vertical). There is no 1080p and no 4K.
//   * Real rate at 720p is USD 0.2312/s, not the model page's "from USD 0.1028/second" (that is 480p).
//
// Usage:
//   node scripts/seedance.mjs --prompt <file.txt> --out <file.mp4> [--res 720p] [--aspect 9:16]
//                             [--duration 5] [--seed N] [--no-audio] [--price-only]
//                             [--size 720x1280] [--callback <https url>] [--provider <json>]
//                             [--first-frame <url>] [--last-frame <url>] [--ref <url>]...
//   node scripts/seedance.mjs --job <id> --out <file.mp4> [--index N]
//                             recover a finished render without paying again (the id is printed
//                             as [job] ... on every submit; re-downloading is free)
// Which flags for which job — the presets and recipes — are in reference/scale.md
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const MODEL = 'bytedance/seedance-2.5';
const API = 'https://openrouter.ai/api/v1/videos';

// USD per second. 720p MEASURED 2026-09-09 (USD 1.16523 for 5.041667 s at 1280x720).
// 480p is the model page's advertised floor and is UNVERIFIED — it has never been billed here.
const RATES = { '480p': 0.1028, '720p': 0.2312 };
const RES = ['480p', '720p'];                                    // this model only; the shared
const ASPECT = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'];    // /videos schema is wider — do
const DUR = { min: 4, max: 30 };                                 // not copy it, it lies for Seedance
const SIZES = ['854x480', '752x560', '640x640', '560x752', '480x854', '992x432',
  '1280x720', '1112x834', '960x960', '834x1112', '720x1280', '1470x630'];
// Which tier a --size bills at, so the estimate stays honest when size replaces resolution.
const sizeTier = (s) => (Math.max(...s.split('x').map(Number)) > 992 ? '720p' : '480p');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i === -1 ? d : args[i + 1]; };
const flag = (k) => args.includes(`--${k}`);
const all = (k) => args.reduce((a, v, i) => (v === `--${k}` ? [...a, args[i + 1]] : a), []);
const die = (m) => { console.error(m); process.exit(1); };

// Checked lazily: --price-only and --list-presets must work on a machine with no key at all, so a
// session can budget before anyone hands it credentials.
const key = process.env.OPENROUTER_API_KEY;
const KEY_HELP = [
  'OPENROUTER_API_KEY is not set. Get one at https://openrouter.ai/settings/keys, then:',
  '  Windows   setx OPENROUTER_API_KEY "sk-or-v1-..."   then start a NEW shell (setx does not',
  '            affect the shell you ran it in)',
  '  macOS/Linux   export OPENROUTER_API_KEY="sk-or-v1-..."   (add it to your shell profile)',
  '  Claude Code on the web   set it in the environment config; nothing machine-local travels',
].join('\n');
const needKey = () => key || die(KEY_HELP);
const H = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

// ---- presets ------------------------------------------------------------------------------------
// The whole point: an agent that wants a vertical beat types --preset shorts-beat and is done.
// Explicit flags always override a preset. Keep this table and reference/scale.md in step.
// Presets default audio OFF: a generated voice is usually a defect, and most pipelines score
// their own audio. Pass --audio when the model's sound is wanted.
const PRESETS = {
  'shorts-beat':      { res: '720p', aspect: '9:16',  duration: 8,  audio: false }, // vertical default
  'shorts-rehearse':  { res: '480p', aspect: '9:16',  duration: 8,  audio: false }, // cheap look first
  'shorts-probe':     { res: '480p', aspect: '9:16',  duration: 4,  audio: false }, // cheapest real render
  'shorts-long':      { res: '720p', aspect: '9:16',  duration: 30, audio: false }, // the 30 s one-take
  'youtube':          { res: '720p', aspect: '16:9',  duration: 8,  audio: false }, // horizontal
  'youtube-long':     { res: '720p', aspect: '16:9',  duration: 30, audio: false },
  'square':           { res: '720p', aspect: '1:1',   duration: 8,  audio: false }, // 960x960 social
  'cinematic':        { res: '720p', aspect: '21:9',  duration: 8,  audio: false }, // 1470x630 insert
};
const presetName = arg('preset');
if (presetName && !PRESETS[presetName])
  die(`--preset must be one of: ${Object.keys(PRESETS).join(', ')}\nSee .claude/skills/seedance-video/reference/scale.md`);
const P = presetName ? PRESETS[presetName] : {};
if (flag('list-presets')) {
  for (const [n, p] of Object.entries(PRESETS))
    console.log(`${n.padEnd(18)} ${p.res} ${p.aspect.padEnd(5)} ${String(p.duration).padStart(2)}s  audio=${p.audio}  ~USD ${(RATES[p.res] * p.duration).toFixed(2)}`);
  process.exit(0);
}

// ---- preflight: is this machine ready to spend? --------------------------------------------------
// Free, no render. The ONE prerequisite this skill cannot self-provide is the key, so check it first.
if (flag('preflight')) {
  const json = flag('json');
  const out = { key: !!key, model: MODEL, ok: false };
  if (!key) {
    out.error = 'OPENROUTER_API_KEY is not set';
    console.log(json ? JSON.stringify(out) : `preflight: NO KEY\n${KEY_HELP}`);
    process.exit(1);
  }
  try {
    const [k, c] = await Promise.all([
      fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${key}` } }).then((r) => r.json()),
      fetch('https://openrouter.ai/api/v1/credits', { headers: { Authorization: `Bearer ${key}` } }).then((r) => r.json()),
    ]);
    if (k.error) { out.error = k.error.message ?? 'key rejected'; console.log(json ? JSON.stringify(out) : `preflight: KEY REJECTED — ${out.error}`); process.exit(1); }
    out.ok = true;
    out.usage = k.data?.usage ?? null;
    out.credits_remaining = c.data ? +(c.data.total_credits - c.data.total_usage).toFixed(2) : null;
    console.log(json ? JSON.stringify(out) : `preflight: OK   credits remaining USD ${out.credits_remaining ?? '?'}   model ${MODEL}`);
    if (out.credits_remaining !== null && out.credits_remaining < 2)
      console.error('[warn] under USD 2.00 left — a single 720p 8s beat costs USD 1.85');
    process.exit(0);
  } catch (e) {
    out.error = String(e.message ?? e);
    console.log(json ? JSON.stringify(out) : `preflight: UNREACHABLE — ${out.error}`);
    process.exit(1);
  }
}

const outFile = arg('out');
const jobId = arg('job');
const promptFile = arg('prompt');
const res = arg('res', P.res ?? '720p');
const aspect = arg('aspect', P.aspect ?? '9:16');
const duration = Number(arg('duration', P.duration ?? 5));
// audio: a preset may turn it off; --audio forces it back on, --no-audio always wins.
const wantAudio = flag('no-audio') ? false : flag('audio') ? true : (P.audio ?? true);

const save = async (id, file) => {
  const idx = arg('index', '0');
  const r = await fetch(`${API}/${id}/content?index=${idx}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) die(`[download] HTTP ${r.status} ${await r.text()}`);
  const buf = Buffer.from(await r.arrayBuffer());
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
  console.log(`[saved] ${file}  ${(buf.length / 1e6).toFixed(1)} MB`);
};

const poll = async (id, file) => {
  for (let i = 0; i < 120; i++) {
    const r = await fetch(`${API}/${id}`, { headers: { Authorization: `Bearer ${key}` } });
    const j = await r.json();
    if (['pending', 'in_progress', 'queued', 'processing'].includes(j.status)) {
      if (i % 4 === 0) console.error(`[poll] ${j.status} (${i * 15}s)`);
      await new Promise((s) => setTimeout(s, 15000));
      continue;
    }
    if (j.status !== 'completed') die(`[failed] status=${j.status} ${j.error?.message ?? JSON.stringify(j)}`);
    // usage.cost is the authoritative USD charge — always print it, never trust the estimate.
    console.log(`[cost] USD ${j.usage?.cost ?? '?'} (actual, billed)`);
    if (file) await save(id, file);
    return j;
  }
  die(`[timeout] still running after 30 min. Recover with: --job ${id} --out <file>`);
};

// ---- recover a paid job -------------------------------------------------------------------------
if (jobId) {
  if (!outFile) die('--job needs --out');
  needKey();
  await poll(jobId, outFile);
  process.exit(0);
}

// ---- validate BEFORE spending -------------------------------------------------------------------
const size = arg('size');
if (size && !SIZES.includes(size)) die(`--size must be one of: ${SIZES.join(', ')}`);
if (size && (args.includes('--res') || args.includes('--aspect')))
  die('--size already fixes width and height; do not pass --res or --aspect with it');
if (!size && !RES.includes(res)) die(`--res must be one of: ${RES.join(', ')} (Seedance 2.5 has no 1080p)`);
if (!size && !ASPECT.includes(aspect)) die(`--aspect must be one of: ${ASPECT.join(', ')}`);
if (!Number.isInteger(duration) || duration < DUR.min || duration > DUR.max)
  die(`--duration must be a whole number ${DUR.min}-${DUR.max}`);

const tier = size ? sizeTier(size) : res;
const shape = size || `${res} ${aspect}`;
const estimate = (RATES[tier] * duration).toFixed(2);
const tag = presetName ? `preset ${presetName}: ` : '';
console.log(`[price] ~USD ${estimate}  (${tag}${shape} ${duration}s audio=${wantAudio} at USD ${RATES[tier]}/s)`);
if (tier === '480p') console.error('[warn] the 480p rate is advertised, never measured here — treat the estimate as soft');
if (flag('price-only')) process.exit(0);

needKey();
if (!promptFile || !outFile) die('--prompt and --out are required');
if (!existsSync(promptFile)) die(`no such prompt file: ${promptFile}`);
const prompt = readFileSync(promptFile, 'utf8').trim();
if (!prompt) die(`prompt file is empty: ${promptFile}`);

const body = { model: MODEL, prompt, duration, generate_audio: wantAudio };
if (size) body.size = size;
else { body.resolution = res; body.aspect_ratio = aspect; }
if (arg('seed')) body.seed = Number(arg('seed'));
if (arg('callback')) body.callback_url = arg('callback');
if (arg('provider')) { try { body.provider = JSON.parse(arg('provider')); } catch { die('--provider must be JSON'); } }

const frames = [];
for (const [k, t] of [['first-frame', 'first_frame'], ['last-frame', 'last_frame']])
  if (arg(k)) frames.push({ type: 'image_url', image_url: { url: arg(k) }, frame_type: t });
if (frames.length) body.frame_images = frames;

const refs = all('ref');
// No cap is enforced by the submit schema (50 was accepted, 2026-09-09) — the provider decides.
// Keep it small and expect an upstream refusal rather than a validation error.
if (refs.length) body.input_references = refs.map((url) => ({ type: 'image_url', image_url: { url } }));

const sub = await fetch(API, { method: 'POST', headers: H, body: JSON.stringify(body) });
const job = await sub.json();
if (!sub.ok || !job.id) die(`[submit] HTTP ${sub.status} ${JSON.stringify(job)}`);

// Printed BEFORE polling: from here the money is spent and there is no cancel. If this process
// dies, the render is still recoverable with --job <id> and must not be re-submitted.
console.log(`[job] ${job.id}   (no cancel exists — recover with: --job ${job.id} --out ${outFile})`);
await poll(job.id, outFile);
