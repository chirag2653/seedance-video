# dev notes — `seedance-video` (Claude Code plugin)

**This is the SOURCE.** Never edit the installed copy under `~/.claude/plugins/cache/…` — it is a
read-only mirror that is wiped on the next `claude plugin update`. Edit here, push, update.

## Structure

```
.claude-plugin/plugin.json     # plugin manifest. NO "version" field — tracks the latest commit SHA
skills/seedance-video/
  SKILL.md                     # what the agent reads to do the job
  reference/scale.md           # which call for which job — presets, recipes, batch rules
  reference/api-contract.md    # the raw endpoint
  scripts/seedance.mjs         # zero-dep Node. Requires Node 18+ for built-in fetch
CLAUDE.md DECISIONS.md README.md LICENSE .gitignore
```

Plugin-only, deliberately — **not** dual-channel. There is no `npx skills` path, because the point is
one thing installed to the account that every repo picks up on `cd`, including Claude Code on the
web. The script still falls back to `~/.agents/skills/seedance-video` if it is ever dropped there.

## Auth

`OPENROUTER_API_KEY` from the environment, and nothing else. Chosen so the plugin ports unchanged to
Claude Code on the web, where machine-local config does not travel but the environment config does.
Never read a key from a file, a repo, or a prompt.

## Update loop

1. Edit here.
2. `node skills/seedance-video/scripts/seedance.mjs --preflight` and the free sweep below.
3. Commit + push to `chirag2653/seedance-video`.
4. `claude plugin update seedance-video` in a **fresh session** — a running session holds the old
   definition.

When OpenRouter changes something:

- `GET /api/v1/videos/models` for the live list — **not** `/api/v1/models`, which hides video.
- Re-read `https://openrouter.ai/bytedance/seedance-2.5/llms.txt`, the canonical vendor doc.
- Probe **only** with an invalid enum value or a malformed URL — those error for free. An unknown
  *field* is ignored and the job renders.
- If the rate moved, re-measure from a real `usage.cost` and update `RATES` in the script, the tables
  in `SKILL.md`, `reference/scale.md` and `README.md` together. Four places, one commit.

## How to test — all free, nothing renders

```bash
S=skills/seedance-video/scripts/seedance.mjs
node $S --preflight                 # OK / NO KEY / KEY REJECTED / UNREACHABLE
node $S --preflight --json          # parseable
node $S --list-presets              # 8 rows, no key needed
node $S --preset shorts-beat --price-only        # ~USD 1.85
node $S --preset shorts-long --price-only        # ~USD 6.94
node $S --preset shorts-beat --duration 12 --price-only   # override wins -> USD 2.77
node $S --price-only --res 1080p                 # must exit 1: no 1080p
node $S --price-only --duration 31               # must exit 1: 4-30
node $S --price-only --size 1080x1920            # must exit 1: not a real size
node $S --price-only --size 720x1280 --res 720p  # must exit 1: mutually exclusive
node $S --preset nope --price-only               # must exit 1 and NAME the valid presets
env -u OPENROUTER_API_KEY node $S --preset shorts-beat --price-only   # must still price
```

⚠️ **Do not test by submitting.** A submit is a purchase and cannot be cancelled. To exercise the
poll and download path, recover a job that has already been paid for:

```bash
node $S --job zh7gL6h9ld2ZAqZEWGHs --out /tmp/x.mp4    # the 2026-09-09 probe render. Free
```

## Open questions

- **`input_references` cap is unknown.** The submit schema accepted 50; the real limit is
  provider-side and refuses after acceptance, which is billable. Nobody has found the edge.
- **`seed` determinism is unverified.** The vendor doc says it is not guaranteed per provider.
- **The 480p rate is unverified** — advertised at USD 0.1028/s, never billed. The script warns.
- **No real prompt has been rendered.** The only output that exists came from the prompt `"x"`.

## Gotcha found on the first install (2026-09-09)

**The plugin cache inserts a commit-SHA directory level:**

```
~/.claude/plugins/cache/<marketplace>/seedance-video/<sha>/skills/seedance-video/
```

`CLAUDE_PLUGIN_ROOT` points at the `<sha>` directory. A resolution snippet that falls back to
`$HOME/.agents/skills/seedance-video` without globbing past the SHA resolves to a path that does not
exist, and the failure surfaces much later as a bare Node `MODULE_NOT_FOUND` with no hint of the real
cause. The snippet in `SKILL.md` therefore globs the cache as its second candidate and **fails loudly**
if nothing is found. Do not simplify it back.

## The cache-glob fallback must sort by TIME, not name (2026-09-09)

Uninstalling from one marketplace and reinstalling from another **leaves the old cache directory on
disk**. After moving this plugin from `claude-code-personal-toolkit` to `public-claude-code-plugins`,
three directories existed:

```
claude-code-personal-toolkit/seedance-video/09f78d9e01c0   <- orphan
claude-code-personal-toolkit/seedance-video/b2de442fad0d   <- orphan, older commit
public-claude-code-plugins/seedance-video/09f78d9e01c0     <- the installed one
```

A plain `ls -d` glob sorts alphabetically and picks the **orphan**. It happened to be the same commit
that day, so it worked and hid the bug; after the next update it would silently run stale code. The
fallback therefore uses **`ls -dt`** (newest first). `CLAUDE_PLUGIN_ROOT` is still tried first and is
correct at real runtime — the glob only matters for manual bash invocation.
