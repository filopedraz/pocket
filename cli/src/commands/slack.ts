/**
 * pocket slack "<message>" --to <dest> — send a Slack message via the
 * Web API `chat.postMessage` endpoint using a bot token.
 *
 * Destination (`--to`) may be a channel ID, a channel name like
 * `#general`, or a user member ID (U...). Falls back to
 * $SLACK_DEFAULT_CHANNEL when omitted. Pass `--thread <ts>` to reply
 * inside an existing thread. Auth prefers $SLACK_USER_TOKEN (xoxp —
 * posts as you) and falls back to $SLACK_BOT_TOKEN (xoxb — posts as
 * the app's bot user).
 */

import { getArg, getPositional } from "../lib/args";
import { error, success } from "../lib/output";
import { MissingTokenError, postSlack } from "../lib/slack";

export async function run() {
  const text = getPositional(0);
  if (!text) error('usage: pocket slack "<message>" --to <channel|userId>', "MISSING_ARG");

  const channel = getArg("--to") ?? process.env.SLACK_DEFAULT_CHANNEL;
  if (!channel) {
    error("no destination: pass --to <channel|userId> or set SLACK_DEFAULT_CHANNEL in .env", "MISSING_DEST");
  }

  // Optional thread reply: --thread <ts> roots the message under an existing
  // message so it shows up inside that thread instead of the channel root.
  const threadTs = getArg("--thread");

  let result: Awaited<ReturnType<typeof postSlack>>;
  try {
    result = await postSlack({ channel: channel as string, text: text as string, threadTs });
  } catch (err) {
    if (err instanceof MissingTokenError) error(err.message, err.code);
    throw err;
  }

  if (!result.ok) {
    const detail = result.messages?.length ? `: ${result.messages.join("; ")}` : "";
    error(`Slack API error: ${result.error ?? "unknown_error"}${detail}`, "SLACK_ERROR");
  }

  success({ ok: true, channel: result.channel, ts: result.ts });
}
