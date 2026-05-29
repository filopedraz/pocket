/**
 * pocket init — scaffold memory/general.md from the embedded template
 * if it doesn't already exist, and ensure chats/ and memory/ exist.
 *
 * Both folders are gitignored except for a .gitkeep, so a fresh clone
 * needs this command to populate them.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getBoolArg } from "../lib/args";
import { writeLine } from "../lib/output";
import { chatsDir, memoryDir, resolveRoot } from "../lib/paths";

const GENERAL_TEMPLATE = `# general

Durable notes about you, the human running this repo. Any agent (Claude Code,
Codex, OpenCode, future arrivals) reads this file at the start of every
session to ground itself in who you are and how you work.

Keep it small. This is not a journal — past conversations live in \`chats/\`.
If a fact is only relevant for one task, don't put it here.

Delete the placeholder sections below that don't apply, and fill in the rest.

---

## Identity

Who you are in one paragraph. Name, role, the work you ship, the location
and timezone you operate from. Skip biography — focus on what changes how
an agent should respond to you.

## Workspace

Where this repo lives on disk. Any sibling repos / directories an agent
should know about. Shell, OS, anything machine-specific that matters.

## Languages

Default language for replies. Other languages you work in and when each
applies (e.g. "Italian with my mother, English with the team").

## Active projects

What you're shipping right now. One line per project: name, what it is,
the stage it's at. Drop projects when they ship or die.

## Key people

Recurring names in your conversations. One line each: who they are,
where they sit in your life, anything an agent needs to handle them
with the right tone.

## Preferences

Things you've found yourself saying twice. Communication style, code
conventions, tools you refuse to use, defaults you want assumed.

## Tools & accounts

CLIs and services you regularly use (no secrets — those go in \`.env\`).
Mention only what changes an agent's defaults (e.g. "I use pnpm, not npm").

## Open loops

Recurring threads to carry across sessions: things you've asked an agent
to keep an eye on, follow-ups that span days, decisions still pending.

## Don'ts

Things you've corrected an agent on more than once. Hard rules: tools to
avoid, phrasings you dislike, mistakes worth never repeating.
`;

export async function run() {
  const force = getBoolArg("--force");
  const root = resolveRoot();
  const memDir = memoryDir(root);
  const chats = chatsDir(root);

  mkdirSync(memDir, { recursive: true });
  mkdirSync(chats, { recursive: true });

  const keepMem = join(memDir, ".gitkeep");
  const keepChats = join(chats, ".gitkeep");
  if (!existsSync(keepMem)) writeFileSync(keepMem, "");
  if (!existsSync(keepChats)) writeFileSync(keepChats, "");

  const generalPath = join(memDir, "general.md");
  if (existsSync(generalPath) && !force) {
    writeLine(`memory/general.md already exists — pass --force to overwrite`);
    writeLine(`done.`);
    return;
  }
  writeFileSync(generalPath, GENERAL_TEMPLATE);
  writeLine(`wrote memory/general.md`);
  writeLine(`done.`);
}
