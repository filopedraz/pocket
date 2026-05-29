#!/usr/bin/env bun

/**
 * pocket CLI — bring your own memory across CLI agents.
 *
 * Usage: pocket <command> [args]
 *
 * Adding a new command (the self-recursive contract):
 *   1. Drop a file at `cli/src/commands/<name>.ts` that exports `run()`.
 *   2. Add one case below in the marked insertion zone.
 *   3. Add a one-line row to the table in README.md.
 *   4. Mention the command in AGENTS.md if an agent should know about it.
 *
 * Keep commands lean — each one should do one thing and exit. Anything
 * heavier belongs in `src/lib/`.
 */

import { getCommand } from "./lib/args";
import { loadProjectEnv } from "./lib/env";
import { error, writeLine } from "./lib/output";

loadProjectEnv();

const VERSION = "0.0.1";

const HELP = `pocket — bring your own memory across CLI agents

usage: pocket <command> [args]

commands:
  init              scaffold memory/general.md and .gitkeep markers
  recent [N]        last N sessions (default 10)
  find <pattern>    grep across chats/
  show <sessionId>  pretty-print one session
  tail              follow the most recently modified session
  doctor            check dependencies and layout
  help              show this message
  version           print version
`;

async function main() {
  const { command } = getCommand();

  switch (command) {
    // >>> add new commands above this line <<<
    case "init":
      return (await import("./commands/init")).run();
    case "recent":
      return (await import("./commands/recent")).run();
    case "find":
      return (await import("./commands/find")).run();
    case "show":
      return (await import("./commands/show")).run();
    case "tail":
      return (await import("./commands/tail")).run();
    case "doctor":
      return (await import("./commands/doctor")).run();

    case "":
    case "help":
    case "--help":
    case "-h":
      writeLine(HELP);
      return;
    case "version":
    case "--version":
    case "-v":
      writeLine(`pocket ${VERSION}`);
      return;
    default:
      error(`Unknown command: ${command}. Run \`pocket help\`.`, "UNKNOWN_COMMAND");
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  error(msg, "UNCAUGHT");
});
