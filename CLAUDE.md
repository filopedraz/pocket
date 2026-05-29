# AGENTS.md

Notes for any AI agent (Claude Code, Codex, OpenCode, …) running inside
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
   to be talked to. Ground every response in it. If the file is missing,
   run `bin/pocket init` first.

2. **Don't auto-ingest `chats/`.** It can be large. Pull from it on demand
   via `bin/pocket` when a topic from a past conversation is relevant.

## The pocket CLI

The `bin/pocket` shim runs a small TypeScript CLI in `cli/` (Bun + Biome).
It is the only thing you should use to read `chats/` or scaffold local
files.

```
bin/pocket init               scaffold memory/general.md + .gitkeep markers
bin/pocket recent [N]         last N sessions across all agents
bin/pocket find <pattern>     grep across every chats/*.jsonl
bin/pocket show <sessionId>   pretty-print one session
bin/pocket tail               follow the active session
bin/pocket doctor             verify deps + layout
bin/pocket help               full list of commands
```

Files in `chats/` follow `YYYY-MM-DD_<agent>_<sessionId>.jsonl`. Each line
is one hook event the agent emitted (`UserPromptSubmit`, `PostToolUse`,
`message.updated`, etc.) with secrets scrubbed by `hooks/log.sh`.

The README has the canonical command table — keep it in sync when you add
or change a command (see below).

## Self-recursive: delegate pocket CLI work to a subagent

The rule, narrowly scoped to **work on this repo's `bin/pocket` CLI**:

- If the human asks for a new pocket subcommand and you don't already
  know exactly how to write it, **spawn a subagent to implement it**
  instead of researching inside the main chat. The subagent's job is to
  return a finished `cli/src/commands/<name>.ts` plus the one-line
  dispatcher patch and the README row. Main context stays small.

- If you need to check whether a library or external CLI already does
  what we're about to build (so we wrap it instead of reinventing it),
  **spawn a subagent for the web/library research**. Have it return a
  short recommendation: "use X, here's how to call it" or "nothing
  fits, build it ourselves."

- Inline (no subagent) is fine for: simple edits to existing pocket
  commands, single-file reads, direct answers, anything outside the
  pocket CLI scope.

The point of the rule is that the agent extends itself over time by
adding small, composable commands without bloating the main chat with
research detours.

## Adding a pocket CLI command

The scaffold is intentionally append-only — drop a file, add one case,
update the README row. No dispatcher rewrite needed.

1. Create `cli/src/commands/<name>.ts` that exports `async function run()`.
   Use the helpers in `cli/src/lib/`:
   - `args.ts` — `getCommand()`, `getPositional(i)`, `getArg("--flag")`,
     `getBoolArg("--flag")`.
   - `output.ts` — `success(data)` for JSON stdout, `error(msg, code)`
     for JSON stderr + exit 1, `writeLine(line)` for human tables.
   - `env.ts` — `loadProjectEnv()` is already called once in
     `src/index.ts`; consume keys via `process.env.X`.
   - `paths.ts` — `resolveRoot()`, `chatsDir()`, `memoryDir()`.

2. Register it in `cli/src/index.ts` under the marked insertion zone:

   ```ts
   // >>> add new commands above this line <<<
   case "<name>":
     return (await import("./commands/<name>")).run();
   ```

   …and add a one-line row to the `HELP` constant.

3. Add one row to the CLI commands table in `README.md`.

4. If an agent should know to reach for this command at session start,
   add a one-line mention to the `## The pocket CLI` block above.

5. From the repo root: `cd cli && bun run typecheck && bun run lint`.

That's the whole contract. New commands ship in one file plus three
one-line touches elsewhere.

## API keys & `.env`

When a command you're building needs an API key:

1. Tell the human exactly which key you need (canonical env var name,
   e.g. `OPENAI_API_KEY`) and what it unlocks.
2. Link the page where they get it (provider dashboard / "Create API
   key" URL).
3. Ask them to paste it into the chat.
4. Append `KEY=<value>` to `.env` at the repo root. Create `.env` if it
   doesn't exist. Never put a real key in `.env.example` — only mirror
   the variable name there (commented).
5. Confirm the new variable name in `.env.example` too, so the next
   collaborator knows to populate it.

`.env` is gitignored. `loadProjectEnv()` in `cli/src/lib/env.ts` already
walks up to the repo root to load it, so once a key is in `.env`, every
pocket command picks it up via `process.env`.

## End of conversation: refresh `memory/general.md`

Before you give the human your final wrap-up of a substantive session,
**spawn a subagent to update memory**. The subagent's brief:

> Read `memory/general.md`. Read the transcript of this session
> (passed in, or fetched via `bin/pocket show <sessionId>`). Propose a
> minimal diff to `memory/general.md`: add only facts the human stated
> twice or stable preferences/identity details. Drop anything one-shot.
> Return the edited file or a `diff`. Do not include secrets.

Use a subagent so the main context doesn't have to re-read the
transcript. Apply the diff, then end your turn.

Skip this for trivial sessions (one-off questions, simple lookups). Run
it for anything where the human revealed durable preferences or named
new people/projects/tools.

## How to update durable memory

`memory/general.md` is the only durable file. Keep it small — this is
not a journal. Add a fact only when:

- The human has said it more than once, or
- It's a stable preference / identity detail that will outlive this
  session.

The template (created by `bin/pocket init`) has sections for: Identity,
Workspace, Languages, Active projects, Key people, Preferences, Tools &
accounts, Open loops, Don'ts. Keep updates inside those sections; add
new sections only if a recurring class of fact doesn't fit anywhere.

One-shot context for the current task does not belong here. That's what
`chats/` is for.

## Never

- **Never write to `chats/` yourself.** The hooks own that folder.
  Manual edits will collide with the next hook firing and confuse the
  log.
- **Never put secrets in `memory/general.md`** (or anywhere else
  tracked in git). API keys go in `.env`; nothing else does.
- **Never commit `.env`.** It's gitignored — keep it that way.
- **Never assume a snapshot.** If the human asks "what's my inbox?",
  use whatever live tool you have. `pocket` does not cache external
  state.

## Adding a new agent (Cursor, Aider, Gemini CLI, …)

The contract:

1. Drop a config file under `.<agent>/` that registers a hook for
   whatever "user sent message" / "tool used" / "session ended" events
   the agent exposes.
2. The hook should pipe its JSON payload into `hooks/log.sh` with
   `POCKET_AGENT=<agent>` in the environment. If the agent's hook
   system doesn't allow shell-out, write a small plugin (see
   `.opencode/plugins/pocket-log.js` for the pattern).
3. Add the required file path to the `REQUIRED` array in
   `cli/src/commands/doctor.ts`.
4. Open a PR.
