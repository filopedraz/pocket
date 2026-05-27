#!/usr/bin/env bash
# pocket: shared session logger for Claude Code + Codex hooks.
#
# Reads a hook payload (JSON) on stdin, scrubs auth headers / embedded URL
# creds / JWTs / common secret-like keys, enriches it with agent + timestamp,
# and appends one JSONL line to:
#
#   chats/<YYYY-MM-DD>_<agent>_<sessionId>.jsonl
#
# Caller must set POCKET_AGENT (e.g. "claude", "codex") so multi-agent
# sessions stay separated.
#
# Dependencies: jq
#
# Exit codes:
#   0 — appended successfully
#   2 — logging error (missing jq, bad stdin, fs failure). Hard-fails so a
#       broken logger is visible, not silent.

set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "pocket/log.sh: jq not found on PATH (brew install jq)" >&2
  exit 2
fi

agent="${POCKET_AGENT:-unknown}"

payload="$(cat)"
if [ -z "$payload" ]; then
  echo "pocket/log.sh: empty payload on stdin (agent=$agent)" >&2
  exit 2
fi

session_id="$(jq -r '.session_id // .sessionId // "unknown"' <<<"$payload" 2>/dev/null || echo unknown)"
cwd="$(jq -r '.cwd // empty' <<<"$payload" 2>/dev/null || true)"
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
base="${repo_root:-${cwd:-$PWD}}"

safe_session_id="$(printf '%s' "$session_id" | tr -cd 'A-Za-z0-9_.-')"
[ -z "$safe_session_id" ] && safe_session_id="unknown"

safe_agent="$(printf '%s' "$agent" | tr -cd 'A-Za-z0-9_.-')"
[ -z "$safe_agent" ] && safe_agent="unknown"

date_stamp="$(date -u +%Y-%m-%d)"
log_dir="$base/chats"
if ! mkdir -p "$log_dir" 2>/dev/null; then
  echo "pocket/log.sh: cannot create $log_dir" >&2
  exit 2
fi

log_file="$log_dir/${date_stamp}_${safe_agent}_${safe_session_id}.jsonl"

scrubbed="$(jq -c --arg agent "$agent" '
  def sensitive_key:
    test("^(authorization|cookie|set-cookie|x-api-key|x-auth-token|proxy-authorization)$"; "i")
    or test("password|passwd|secret|token|api[_-]?key|bearer|private[_-]?key|client[_-]?secret"; "i");

  def scrub_string:
    if type != "string" then .
    else
      gsub("(?<k>authorization|cookie|set-cookie|x-api-key|x-auth-token|bearer)\\s*[:=]\\s*(Bearer\\s+)?[^\\s\"'\''\\\\&|;,]+"; "\(.k): [REDACTED]"; "i")
      | gsub("(?<k>password|passwd|secret|token|api[_-]?key|private[_-]?key|client[_-]?secret)\"?\\s*[:=]\\s*\"?[^\\s\"'\'';,&|]+"; "\(.k)=[REDACTED]"; "i")
      | gsub("://(?<u>[^:/@\\s]+):(?<p>[^@\\s]+)@"; "://[REDACTED]:[REDACTED]@")
      | gsub("eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}"; "[REDACTED-JWT]")
    end;

  def scrub:
    if type == "object" then
      with_entries(
        if (.key | tostring | sensitive_key)
        then .value = "[REDACTED]"
        else .value |= scrub end
      )
    elif type == "array" then map(scrub)
    else scrub_string end;

  scrub + {
    agent: $agent,
    logged_at: (now | todate),
    log_event: (.hook_event_name // .event // "unknown")
  }
' <<<"$payload")" || { echo "pocket/log.sh: jq scrub failed" >&2; exit 2; }

if ! printf '%s\n' "$scrubbed" >> "$log_file"; then
  echo "pocket/log.sh: append to $log_file failed" >&2
  exit 2
fi

exit 0
