import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

function findEnvFile(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 20; i++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Walk up from this module and from cwd to find a project-root `.env`,
 * merging keys into process.env without overriding existing values.
 */
export function loadProjectEnv(): void {
  const candidates = [import.meta.dir, process.cwd()];
  const seen = new Set<string>();
  for (const start of candidates) {
    const path = findEnvFile(start);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    try {
      const parsed = parseEnvFile(readFileSync(path, "utf-8"));
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
    } catch {
      // Best-effort.
    }
  }
}
