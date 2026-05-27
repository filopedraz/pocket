// pocket: OpenCode plugin that appends session events to chats/.
//
// Mirrors the format produced by hooks/log.sh for Claude Code + Codex, so
// `bin/pocket find` and friends see one unified log stream.
//
// Loaded automatically by OpenCode from .opencode/plugins/ at startup.

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const AGENT = "opencode";

function repoRoot() {
  try {
    return execSync("git rev-parse --show-toplevel", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return process.cwd();
  }
}

function safe(part) {
  return String(part || "unknown").replace(/[^A-Za-z0-9_.-]/g, "") || "unknown";
}

const SENSITIVE_KEY = /^(authorization|cookie|set-cookie|x-api-key|x-auth-token|proxy-authorization)$|password|passwd|secret|token|api[_-]?key|bearer|private[_-]?key|client[_-]?secret/i;

function scrubString(s) {
  if (typeof s !== "string") return s;
  return s
    .replace(/(authorization|cookie|set-cookie|x-api-key|x-auth-token|bearer)\s*[:=]\s*(Bearer\s+)?[^\s"'\\&|;,]+/gi, "$1: [REDACTED]")
    .replace(/(password|passwd|secret|token|api[_-]?key|private[_-]?key|client[_-]?secret)"?\s*[:=]\s*"?[^\s";,&|]+/gi, "$1=[REDACTED]")
    .replace(/:\/\/[^:/@\s]+:[^@\s]+@/g, "://[REDACTED]:[REDACTED]@")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED-JWT]");
}

function scrub(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(scrub);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : scrub(v);
    }
    return out;
  }
  if (typeof value === "string") return scrubString(value);
  return value;
}

function append(event, sessionId, payload) {
  const root = repoRoot();
  const dir = join(root, "chats");
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error(`pocket-log: cannot create ${dir}: ${err.message}`);
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  const file = join(dir, `${date}_${AGENT}_${safe(sessionId)}.jsonl`);
  const line = JSON.stringify({
    ...scrub(payload),
    session_id: sessionId,
    agent: AGENT,
    logged_at: new Date().toISOString(),
    log_event: event,
  });
  try {
    appendFileSync(file, line + "\n");
  } catch (err) {
    console.error(`pocket-log: append to ${file} failed: ${err.message}`);
  }
}

export const PocketLog = async () => ({
  "session.created": async (input) => {
    append("session.created", input?.sessionID ?? input?.session?.id, input);
  },
  "session.idle": async (input) => {
    append("session.idle", input?.sessionID ?? input?.session?.id, input);
  },
  "message.updated": async (input) => {
    append("message.updated", input?.sessionID ?? input?.message?.sessionID, input);
  },
  "tool.execute.before": async (input, output) => {
    append("tool.execute.before", input?.sessionID, { input, output });
  },
  "tool.execute.after": async (input, output) => {
    append("tool.execute.after", input?.sessionID, { input, output });
  },
});
