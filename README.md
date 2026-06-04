# pocket

> Bring your own memory. Switch CLI agents without losing context.

A folder. Some hooks. A tiny TypeScript CLI. Three CLI agents wired in.
No daemon, no SaaS, no lock-in.

## Why

Desktop apps and web chats lock your conversations inside a single vendor.
Hit the rate limit on Claude and your context is stuck there. Burn through
your Codex credits and you start the next session from zero. Switch
providers and yesterday's reasoning is gone.

`pocket` flips it. One repo. One folder of markdown about you. One folder
of conversation logs. Every CLI agent reads from the same place and writes
back to the same place. Switching providers is just changing which binary
you type.

The setup:

- **`memory/general.md`** — what an agent should know about you. Durable,
  small, human-edited. Created from a template by `bin/pocket init`.
- **`chats/`** — every session, every agent, one JSONL file each.
  Populated automatically by hooks. Local-only by default.
- **`bin/pocket`** — TypeScript CLI: `init`, `recent`, `find`, `show`,
  `tail`, `doctor`.

## Quickstart

```bash
git clone https://github.com/filopedraz/pocket.git
cd pocket
bin/pocket init                # scaffold memory/general.md
$EDITOR memory/general.md      # tell agents who you are
cp .env.example .env           # if you have keys to store
git config core.hooksPath .githooks   # enable AGENTS.md → CLAUDE.md sync hook
bin/pocket doctor              # check deps (needs bun)
```

From here, run whichever CLI agent you like inside this directory — its
hooks are pre-wired.

```bash
claude       # Claude Code session — auto-logs to chats/
codex        # Codex session — auto-logs to chats/
opencode     # OpenCode session — plugin auto-logs to chats/
```

To find what you talked about yesterday:

```bash
bin/pocket recent              # last 10 sessions, any agent
bin/pocket find "kafka"        # grep across all chats
bin/pocket show <sessionId>    # pretty-print one session
```

## CLI commands

| Command | What it does |
|---|---|
| `bin/pocket init` | Scaffold `memory/general.md` from the embedded template and ensure `.gitkeep` markers exist. Re-run with `--force` to overwrite. |
| `bin/pocket recent [N]` | Last N sessions across all agents (default 10), sorted by mtime. |
| `bin/pocket find <pattern>` | Literal-string grep across every `chats/*.jsonl`. |
| `bin/pocket show <sessionId>` | Pretty-print every JSONL line of the matching session. |
| `bin/pocket tail` | Follow the most recently modified session file. |
| `bin/pocket doctor` | Verify bun is installed and every agent's hook plumbing is in place. |
| `bin/pocket slack "<msg>" --to <dest>` | Send a message to Slack via `chat.postMessage`. `<dest>` is a channel ID/name (`#general`) or user ID (`U…`); falls back to `SLACK_DEFAULT_CHANNEL`. Needs `SLACK_BOT_TOKEN` in `.env`. |
| `bin/pocket email "<body>" --to <addr> [--subject "<s>"] [--cc <addr>] [--bcc <addr>]` | Send an email via Gmail SMTP (`smtp.gmail.com:465`). Needs `GMAIL_USER` and `GMAIL_APP_PASSWORD` ([App Password](https://myaccount.google.com/apppasswords)) in `.env`. |
| `bin/pocket briefing [--to <dest>] [--dry-run]` | Compose a short Italian morning briefing from the `## Oggi` section of repo-root `todos.md` and post it to Slack. `<dest>` falls back to `SLACK_BRIEFING_TARGET` then a self-DM default; `--dry-run` prints the briefing instead of posting. Needs a Slack token in `.env`. |
| `bin/pocket notion tickets [--all] [--json]` | List open tickets from the "M&S Tickets" Notion database, sorted by priority then due date. Defaults to your own tickets; `--all` shows everyone's; `--json` prints raw JSON. Needs `NOTION_TOKEN` and `NOTION_TICKETS_DB` (and `NOTION_USER_ID` for the default scope) in `.env`. |
| `bin/pocket help` | Print the live command list. |

This table is the source of truth. New commands land here in the same PR
that adds them — see [Adding a pocket CLI command](AGENTS.md#adding-a-pocket-cli-command).

## How it works

Three thin layers — no service, no background daemon.

**1. Hooks.** Each agent's hook config (`.claude/settings.json`,
`.codex/hooks.json`, `.opencode/plugins/pocket-log.js`) fires on every user
prompt, tool use, and session end. The hook serialises the event and pipes
it into `hooks/log.sh`.

**2. Logger.** `hooks/log.sh` is the shared scrub-and-append script. It
strips auth headers, embedded URL credentials, JWTs, and obvious secrets,
then writes one JSONL line to `chats/<date>_<agent>_<sessionId>.jsonl`.
Claude Code and Codex both call it directly. OpenCode runs the same logic
inside its JS plugin (their plugin API doesn't shell out).

**3. Retrieval.** `bin/pocket` is a Bun-runtime TypeScript CLI in `cli/`.
Each subcommand lives at `cli/src/commands/<name>.ts` — adding one means
dropping a file and a single dispatcher case. See AGENTS.md for the full
contract.

## Self-recursive

Agents working in this repo are told (via `AGENTS.md`) to extend the
pocket CLI by spawning subagents — both for implementing unfamiliar
commands and for researching whether a library already does the job.
That keeps the main chat lean and lets the toolset grow without
context bloat. You don't have to opt in; any agent reading
`memory/general.md` at session start picks up the rule.

## Supported agents

| Agent       | Hook surface                      | Captured events                                          |
|-------------|-----------------------------------|----------------------------------------------------------|
| Claude Code | `.claude/settings.json`           | `UserPromptSubmit`, `PostToolUse`, `Stop`                |
| Codex       | `.codex/hooks.json`               | `PreToolUse`, `PermissionRequest`, `PostToolUse`         |
| OpenCode    | `.opencode/plugins/pocket-log.js` | `session.created`, `session.idle`, `message.updated`, `tool.execute.before`, `tool.execute.after` |

Want another agent? See [Adding a new agent](AGENTS.md#adding-a-new-agent-cursor-aider-gemini-cli-) in AGENTS.md. PRs welcome for Cursor, Aider, Gemini CLI, anything with a hook or plugin surface.

## Repo layout

```
pocket/
├── memory/
│   ├── .gitkeep            # folder marker; contents gitignored
│   └── general.md          # durable notes about you (local-only)
├── chats/
│   ├── .gitkeep            # folder marker; contents gitignored
│   └── *.jsonl             # one per session (local-only)
├── hooks/
│   └── log.sh              # shared scrub-and-append (Claude + Codex)
├── cli/
│   ├── package.json        # bun + biome
│   ├── tsconfig.json
│   ├── biome.json
│   ├── build.ts            # `bun run build` → cli/dist/pocket
│   └── src/
│       ├── index.ts        # dispatcher (one switch case per command)
│       ├── commands/       # one file per subcommand
│       └── lib/            # args, output, env, paths helpers
├── bin/
│   └── pocket              # bash shim: prefers compiled binary, falls back to `bun run`
├── .claude/settings.json   # Claude Code hooks
├── .codex/hooks.json       # Codex hooks
├── .opencode/plugins/      # OpenCode plugin
├── .env.example            # secrets template; copy to .env (gitignored)
├── .githooks/              # tracked git hooks (enable: git config core.hooksPath .githooks)
├── AGENTS.md               # instructions for any agent in this repo
└── CLAUDE.md               # mirror of AGENTS.md (pre-commit hook keeps it in sync)
```

## Privacy

`chats/` and `memory/` are **gitignored by default**. Both folders ship
with a `.gitkeep` so a fresh clone has somewhere to write, but the
contents stay on your machine. If you want them committed (e.g. so a
`git pull` on another machine brings your memory with you), make the
repo private and remove the carve-outs from `.gitignore`.

`hooks/log.sh` scrubs the obvious things (auth headers, URL creds, JWTs,
anything keyed `password` / `token` / `api_key` / `secret`). It is **not**
a full PII redactor. Skim a session before you commit it if you typed
something you don't want on GitHub.

## Dependencies

- `bun` ≥ 1.0 — `curl -fsSL https://bun.sh/install | bash`
- `bash` (POSIX-ish, tested on macOS + Linux)
- `git` — for repo-root resolution

## Status

Early. The shape is right. Expect rough edges on cross-platform paths and
on agents that change their hook payloads between releases. Open an issue
if something breaks.

## License

MIT. See [LICENSE](LICENSE).
