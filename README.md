# pocket

> A self-extending CLI agent.
> It grows its own tools.
> It remembers you across vendors.

A folder. Some hooks. A tiny TypeScript CLI. When the agent needs a
capability it doesn't have, it writes the command into
`cli/src/commands/` and uses it on the next run. When the session ends,
a subagent updates `memory/general.md` with what was durable. Switch
from Claude to Codex to OpenCode tomorrow — the folder doesn't move.

## Why

Most "AI memory" tools are read-only state you pour into a vendor's
context window. They don't change what the agent can do; they just give
it more to read. And when that vendor rate-limits you or your credits
run out, the memory is stuck inside their walls.

`pocket` is the other shape. Two things live in this repo:

1. **What the agent knows about you** — `memory/general.md`. Small,
   durable, refreshed at the end of each session by a subagent that
   reads the transcript and proposes a diff.
2. **What the agent can do** — `cli/src/commands/`. Every time the agent
   hits a task it can't do directly, the rule in `AGENTS.md` tells it
   to spawn a subagent, implement a new `bin/pocket <command>`, and add
   it to the toolset. Next session it just calls the command.

Both are plain files in a git repo. Every supported CLI agent
(`claude`, `codex`, `opencode`) reads them at session start and writes
back to them on the way out, via pre-wired hooks. Switching providers is
changing which binary you type.

The pieces:

- **`memory/general.md`** — what an agent should know about you.
  Durable, small. Created from a template by `bin/pocket init`; refreshed
  by a subagent at the end of each substantive session.
- **`cli/src/commands/`** — the agent's growing toolset. One TypeScript
  file per subcommand; the agent appends here through subagents.
- **`chats/`** — every session, every agent, one JSONL file each. Local
  by default. Populated automatically by hooks; queryable via
  `bin/pocket recent / find / show / tail`.

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

**3. Toolset.** `bin/pocket` is a Bun-runtime TypeScript CLI in `cli/`.
Each subcommand lives at `cli/src/commands/<name>.ts` — adding one means
dropping a file and a single dispatcher case. This is both how *you*
query the chat history (`recent`, `find`, `show`, `tail`) and how the
*agent* grows its own capabilities over time. See AGENTS.md for the
full contract.

## How the agent extends itself

The self-extension loop lives in `AGENTS.md` (mirrored to `CLAUDE.md`),
which every supported agent reads at session start. The rules, in
order:

1. **Read `memory/general.md`** to know who you are.
2. **Hit a task you can't do directly?** Spawn a subagent to either
   research a library that already does it, or implement a new
   `cli/src/commands/<name>.ts` end-to-end. The new command shows up
   in `bin/pocket <name>` on the very next run.
3. **Need an API key?** Tell the human which one, link the page, ask
   them to paste it, and append `KEY=value` to `.env` — `.env.example`
   gets the mirrored variable name.
4. **End of session?** Spawn a subagent that reads the transcript and
   proposes a minimal diff to `memory/general.md`. Apply, end the turn.

You don't opt in — any agent that reads `AGENTS.md` picks up the rules.
The point is that the toolset and the memory both grow on their own
without the main chat carrying the weight of research, refactoring, or
re-reading transcripts.

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
