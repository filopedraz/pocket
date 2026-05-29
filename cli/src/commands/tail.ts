/**
 * pocket tail — follow the most recently modified session file.
 *
 * Streams new lines as they're appended by the hooks. Exits on Ctrl-C.
 */

import { spawn } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { error } from "../lib/output";
import { chatsDir } from "../lib/paths";

export async function run() {
  const dir = chatsDir();
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    error(`No chats/ directory at ${dir}`, "NO_CHATS_DIR");
  }
  if (entries.length === 0) error("No sessions yet", "NO_SESSIONS");

  const latest = entries
    .map((f) => ({ f, mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0]!.f;

  process.stderr.write(`── tailing ${latest} ──\n`);
  const child = spawn("tail", ["-F", join(dir, latest)], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
}
