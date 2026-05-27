# AGENTS.md

Notes for any AI agent (Claude Code, Codex, OpenCode, etc.) running inside
this repo.

## What this repo is

A `pocket` — a portable memory store for CLI agents. The whole point: you
read durable knowledge from `memory/general.md` at the start of every
session, and you can recall past conversations from `chats/` regardless of
which agent originally produced them.

If the human runs out of credits on one provider, they switch CLIs. The
folder layout doesn't move. The context is still here.

## What to do at session start

1. **Read `memory/general.md`.** That's who the human is and how they want
   to be talked to. Ground every response in it.

2. **Don't auto-ingest `chats/`.** It can be large. Pull from it on demand
   via `bin/pocket` when a topic from a past conversation is relevant.

## How to recall past context

The `bin/pocket` CLI is the only thing you should use to read `chats/`.

```
bin/pocket recent [N]         # last N sessions across all agents
bin/pocket find <pattern>     # grep across every .jsonl
bin/pocket show <sessionId>   # pretty-print one session
bin/pocket tail               # follow the active session
bin/pocket doctor             # verify deps + layout
```

Files in `chats/` follow `YYYY-MM-DD_<agent>_<sessionId>.jsonl`. Each line is
one hook event the agent emitted (`UserPromptSubmit`, `PostToolUse`,
`message.updated`, etc.) with secrets scrubbed.

## How to update durable memory

Edit `memory/general.md` directly. Keep it small — this is not a journal.
Add a fact only when:

- The human has said it more than once, or
- It's a stable preference / identity detail that will outlive this session.

One-shot context for the current task does not belong here. That's what
`chats/` is for.

## Never

- **Never write to `chats/` yourself.** The hooks own that folder. Manual
  edits will collide with the next hook firing and confuse the log.
- **Never put secrets in `memory/general.md`.** This repo may be committed
  publicly. Treat `memory/` like a README: anything in it could end up on
  GitHub.
- **Never assume a snapshot.** If the human asks "what's my inbox?", use
  whatever live tool you have. `pocket` does not cache external state.

## Adding a new agent

If you're adding support for a new CLI agent (Cursor, Aider, Gemini CLI,
…) the contract is:

1. Drop a config file under `.<agent>/` that registers a hook for whatever
   "user sent message" / "tool used" / "session ended" events the agent
   exposes.
2. The hook should pipe its JSON payload into `hooks/log.sh` with
   `POCKET_AGENT=<agent>` in the environment. If the agent's hook system
   doesn't allow shell-out, write a small plugin (see
   `.opencode/plugins/pocket-log.js` for the pattern).
3. Update `bin/pocket doctor` to check for the new config file.
4. Open a PR.
