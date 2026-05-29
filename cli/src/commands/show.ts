/**
 * pocket show <sessionId> — pretty-print every JSONL line of one session.
 *
 * Matches files whose name ends with `_<sessionId>.jsonl`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPositional } from "../lib/args";
import { error, writeLine } from "../lib/output";
import { chatsDir } from "../lib/paths";

export async function run() {
  const sid = getPositional(0);
  if (!sid) error("show requires a sessionId", "MISSING_ARG");

  const dir = chatsDir();
  let matches: string[];
  try {
    matches = readdirSync(dir).filter((f) => f.endsWith(`_${sid}.jsonl`));
  } catch {
    error(`No chats/ directory at ${dir}`, "NO_CHATS_DIR");
  }

  if (matches.length === 0) error(`No session matching "${sid}"`, "NO_MATCH");

  for (const f of matches) {
    writeLine(`── ${f} ──`);
    const contents = readFileSync(join(dir, f), "utf-8");
    for (const line of contents.split("\n")) {
      if (!line.trim()) continue;
      try {
        writeLine(JSON.stringify(JSON.parse(line), null, 2));
      } catch {
        writeLine(line);
      }
    }
  }
}
