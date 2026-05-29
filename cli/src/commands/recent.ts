/**
 * pocket recent [N] — last N sessions across all agents (default 10),
 * sorted by mtime descending.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getPositional } from "../lib/args";
import { error, writeLine } from "../lib/output";
import { chatsDir } from "../lib/paths";

interface Row {
  date: string;
  agent: string;
  session: string;
  firstEvent: string;
}

function parseFilename(name: string): { date: string; agent: string; session: string } | null {
  const base = name.replace(/\.jsonl$/, "");
  const parts = base.split("_");
  if (parts.length < 3) return null;
  const date = parts[0]!;
  const agent = parts[1]!;
  const session = parts.slice(2).join("_");
  return { date, agent, session };
}

function firstEventOf(path: string): string {
  try {
    const head = readFileSync(path, "utf-8").split("\n", 1)[0] ?? "";
    if (!head) return "?";
    const obj = JSON.parse(head);
    return obj.log_event ?? obj.hook_event_name ?? "?";
  } catch {
    return "?";
  }
}

export async function run() {
  const nArg = getPositional(0);
  const n = nArg ? Number.parseInt(nArg, 10) : 10;
  if (Number.isNaN(n) || n < 1) error(`Invalid N: ${nArg}`, "BAD_ARG");

  const dir = chatsDir();
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    error(`No chats/ directory at ${dir}`, "NO_CHATS_DIR");
  }

  if (entries.length === 0) {
    writeLine(`pocket: no sessions in ${dir} yet`);
    return;
  }

  const sorted = entries
    .map((f) => ({ f, mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, n)
    .map(({ f }) => f);

  const rows: Row[] = [];
  for (const f of sorted) {
    const parsed = parseFilename(f);
    if (!parsed) continue;
    rows.push({
      ...parsed,
      firstEvent: firstEventOf(join(dir, f)),
    });
  }

  writeLine(["DATE".padEnd(12), "AGENT".padEnd(9), "SESSION".padEnd(36), "FIRST_EVENT"].join("  "));
  for (const r of rows) {
    writeLine([r.date.padEnd(12), r.agent.padEnd(9), r.session.padEnd(36), r.firstEvent].join("  "));
  }
}
