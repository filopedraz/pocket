/**
 * Shared Slack posting helper. Wraps the Web API `chat.postMessage`
 * endpoint so multiple commands (`slack`, `briefing`, …) can post without
 * duplicating fetch/auth/parse logic.
 *
 * Auth prefers $SLACK_USER_TOKEN (xoxp — posts as you) and falls back to
 * $SLACK_BOT_TOKEN (xoxb — posts as the app's bot user).
 *
 * This module deliberately does NOT call into the output helpers
 * (success/error). It returns a normalized result and lets the caller
 * decide how to report. The one exception is the missing-token case, which
 * throws a typed `MissingTokenError` so callers can surface a clear message.
 */

export class MissingTokenError extends Error {
  readonly code = "MISSING_TOKEN";
  constructor(message: string) {
    super(message);
    this.name = "MissingTokenError";
  }
}

interface PostMessageResponse {
  ok: boolean;
  channel?: string;
  ts?: string;
  error?: string;
  response_metadata?: { messages?: string[] };
}

export interface PostSlackResult {
  ok: boolean;
  channel?: string;
  ts?: string;
  error?: string;
  messages?: string[];
}

export async function postSlack(opts: { channel: string; text: string; threadTs?: string }): Promise<PostSlackResult> {
  const token = process.env.SLACK_USER_TOKEN ?? process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new MissingTokenError(
      "missing token: add SLACK_USER_TOKEN (xoxp, posts as you) or SLACK_BOT_TOKEN (xoxb) to .env (from your app's OAuth & Permissions page, https://api.slack.com/apps)",
    );
  }

  const payload: Record<string, string> = { channel: opts.channel, text: opts.text };
  if (opts.threadTs) payload.thread_ts = opts.threadTs;

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as PostMessageResponse;

  return {
    ok: data.ok,
    channel: data.channel,
    ts: data.ts,
    error: data.error,
    messages: data.response_metadata?.messages,
  };
}
