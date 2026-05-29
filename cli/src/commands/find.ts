/**
 * pocket find <pattern> — grep across every chats/*.jsonl.
 *
 * Prints matches grouped by file. Pattern is matched literally
 * (case-sensitive) against each JSONL line.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPositional } from "../lib/args";
import { error, writeLine } from "../lib/output";
import { chatsDir } from "../lib/paths";

export async function run() {
  const pattern = getPositional(0);
  if (!pattern) error("find requires a pattern", "MISSING_ARG");

  const dir = chatsDir();
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    error(`No chats/ directory at ${dir}`, "NO_CHATS_DIR");
  }

  let anyHit = false;
  for (const f of files) {
    const path = join(dir, f);
    let contents: string;
    try {
      contents = readFileSync(path, "utf-8");
    } catch {
      continue;
    }
    const lines = contents.split("\n");
    const hits: Array<{ line: number; text: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.includes(pattern)) hits.push({ line: i + 1, text: lines[i]! });
    }
    if (hits.length === 0) continue;
    anyHit = true;
    writeLine(`── ${f} ──`);
    for (const h of hits) writeLine(`${h.line}: ${h.text}`);
    writeLine("");
  }

  if (!anyHit) writeLine(`pocket: no matches for "${pattern}"`);
}
