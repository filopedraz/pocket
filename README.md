# pocket

> Bring your own memory. Switch CLI agents without losing context.

A folder. Some hooks. Three CLI agents wired in. No daemon, no SaaS, no
lock-in.

## Why

Desktop apps and web chats lock your conversations inside a single vendor.
Hit the rate limit on Claude and your context is stuck there. Burn through
your Codex credits and you start the next session from zero. Switch
providers and yesterday's reasoning is gone.

`pocket` flips it. One GitHub repo. One folder of markdown about you. One
folder of conversation logs. Every CLI agent reads from the same place and
writes back to the same place. Switching providers is just changing which
binary you type.

The setup:

- **`memory/general.md`** — what an agent should know about you. Durable,
  small, human-edited.
- **`chats/`** — every session, every agent, one JSONL file each. Populated
  automatically by hooks.
- **`bin/pocket`** — recall past sessions: `recent`, `find`, `show`, `tail`.

## Quickstart

```bash
git clone https://github.com/filopedraz/pocket.git
cd pocket
$EDITOR memory/general.md      # tell agents who you are
bin/pocket doctor              # check deps (needs jq)
```

That's the install step. From here, run whichever CLI agent you like inside
this directory — its hooks are pre-wired.

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

**3. Retrieval.** `bin/pocket` is a POSIX-shell dispatcher over `chats/`.
`recent` sorts by mtime, `find` is a grep wrapper, `show` is jq pretty-print.
Nothing fancy — the value is the layout, not the tool.

## Supported agents

| Agent       | Hook surface                      | Captured events                                          |
|-------------|-----------------------------------|----------------------------------------------------------|
| Claude Code | `.claude/settings.json`           | `UserPromptSubmit`, `PostToolUse`, `Stop`                |
| Codex       | `.codex/hooks.json`               | `PreToolUse`, `PermissionRequest`, `PostToolUse`         |
| OpenCode    | `.opencode/plugins/pocket-log.js` | `session.created`, `session.idle`, `message.updated`, `tool.execute.before`, `tool.execute.after` |

Want another agent? See [Adding a new agent](AGENTS.md#adding-a-new-agent) in
`AGENTS.md`. PRs welcome for Cursor, Aider, Gemini CLI, anything with a
hook or plugin surface.

## Repo layout

```
pocket/
├── memory/
│   └── general.md          # durable notes about you. start here.
├── chats/                  # one .jsonl per session. committed.
├── hooks/
│   └── log.sh              # shared scrub-and-append (Claude + Codex)
├── bin/
│   └── pocket              # POSIX-shell CLI: recent | find | show | tail | doctor
├── .claude/settings.json   # Claude Code hooks
├── .codex/hooks.json       # Codex hooks
├── .opencode/plugins/      # OpenCode plugin
├── AGENTS.md               # instructions for any agent in this repo
└── CLAUDE.md               # symlink → AGENTS.md
```

## Privacy

`chats/` is **committed to git by default** — so a `git pull` on a new
machine brings your memory and your history with you. If your conversations
are sensitive: **make the repo private**, or fork and remove `chats/` from
git tracking. The repo is yours; the trade-off is yours.

`hooks/log.sh` scrubs the obvious things (auth headers, URL creds, JWTs,
anything keyed `password` / `token` / `api_key` / `secret`). It is **not**
a full PII redactor. Skim a session before you commit it if you typed
something you don't want on GitHub.

## Dependencies

- `bash` (POSIX-ish, tested on macOS + Linux)
- `jq` — `brew install jq` / `apt install jq`
- `node` ≥ 18 — only if you use the OpenCode plugin
- `git` — for repo-root resolution

## Status

Early. The shape is right. Expect rough edges on cross-platform paths and
on agents that change their hook payloads between releases. Open an issue
if something breaks.

## License

MIT. See [LICENSE](LICENSE).
