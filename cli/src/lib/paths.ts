import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Resolve the pocket repo root. Priority:
 *   1. $POCKET_ROOT
 *   2. git toplevel of cwd
 *   3. nearest ancestor containing `memory/` and `chats/`
 *   4. cwd
 */
export function resolveRoot(): string {
  const fromEnv = process.env.POCKET_ROOT;
  if (fromEnv) return resolve(fromEnv);

  const git = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
  if (git.status === 0) return git.stdout.trim();

  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, "memory")) && existsSync(join(dir, "chats"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function chatsDir(root = resolveRoot()): string {
  return join(root, "chats");
}

export function memoryDir(root = resolveRoot()): string {
  return join(root, "memory");
}
