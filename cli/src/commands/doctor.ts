/**
 * pocket doctor — verify dependencies and repo layout.
 *
 * Checks: bun present, repo root resolves, required files exist for
 * every supported agent's hook plumbing.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { writeLine } from "../lib/output";
import { chatsDir, memoryDir, resolveRoot } from "../lib/paths";

const REQUIRED = [
  "hooks/log.sh",
  ".claude/settings.json",
  ".codex/hooks.json",
  ".opencode/plugins/pocket-log.js",
  "memory/general.md",
  "cli/src/index.ts",
];

export async function run() {
  const root = resolveRoot();
  writeLine(`root:      ${root}`);
  writeLine(`chats:     ${chatsDir(root)}`);
  writeLine(`memory:    ${memoryDir(root)}`);

  let ok = true;

  const bun = spawnSync("bun", ["--version"], { encoding: "utf-8" });
  if (bun.status === 0) {
    writeLine(`bun:       ${bun.stdout.trim()}`);
  } else {
    writeLine(`bun:       MISSING (https://bun.sh)`);
    ok = false;
  }

  for (const rel of REQUIRED) {
    const present = existsSync(join(root, rel));
    writeLine(`${present ? "ok:       " : "missing:  "} ${rel}`);
    if (!present) ok = false;
  }

  const hooksPath = spawnSync("git", ["config", "--get", "core.hooksPath"], {
    cwd: root,
    encoding: "utf-8",
  });
  const configured = hooksPath.status === 0 ? hooksPath.stdout.trim() : "";
  if (configured === ".githooks") {
    writeLine(`hooks:     core.hooksPath=.githooks`);
  } else {
    writeLine(`hooks:     core.hooksPath unset — run: git config core.hooksPath .githooks`);
  }

  if (!ok) process.exit(1);
}
