---
name: Add a new agent
about: Propose support for a CLI agent that isn't wired in yet
title: "Add <agent> support"
labels: ["agent-support"]
---

## Agent

Which CLI agent are you proposing? Link to its docs.

## Hook surface

What hook or plugin API does the agent expose? Which events fire on:

- User submits a prompt:
- Tool / shell command executed:
- Session ends:

## Payload shape

What does the agent pass to the hook (stdin JSON, function arguments, env
vars)? Paste a minimal example if you have one.

## Plan

How would you wire it? Three options, in rough order of simplicity:

- **Shell hook → `hooks/log.sh`**: works if the agent can shell out. Set
  `POCKET_AGENT=<agent>` in the env and pipe the payload into the script.
- **Plugin/extension**: write a small file under `.<agent>/plugins/` (or
  wherever the agent loads code from) that mirrors `.opencode/plugins/pocket-log.js`.
- **Other**: explain.

## Anything else

Quirks, blockers, open questions.
