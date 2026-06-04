/**
 * pocket notion tickets [--all] [--json] — list open tickets from the
 * "M&S Tickets" Notion database.
 *
 * By default shows only tickets assigned to you ($NOTION_USER_ID). Pass
 * `--all` to show everyone's open tickets. `--json` prints the raw array
 * for piping through `jq`; otherwise a compact human table is printed,
 * sorted by priority then due date.
 *
 * Needs $NOTION_TOKEN and $NOTION_TICKETS_DB in .env (and $NOTION_USER_ID
 * for the default "mine only" scope).
 */

import { getBoolArg, getPositional } from "../lib/args";
import { fetchOpenTickets, MissingConfigError, type Ticket } from "../lib/notion";
import { error, success, writeLine } from "../lib/output";

const PRIORITY_EMOJI: Record<string, string> = {
  Urgent: "🔴",
  High: "🟠",
  Mid: "🟡",
  Low: "⚪",
};

function emojiFor(priority: string): string {
  return PRIORITY_EMOJI[priority] ?? "⚫";
}

function renderLine(t: Ticket): string {
  let line = `${emojiFor(t.priority)} ${t.name} — ${t.status || "?"}`;
  if (t.due) line += ` · due ${t.due}`;
  if (t.assignees.length > 0) line += ` · ${t.assignees.join(", ")}`;
  return line;
}

export async function run() {
  const sub = getPositional(0);
  if (sub !== undefined && sub !== "tickets") {
    error(`unknown notion subcommand: ${sub}. usage: pocket notion tickets [--all] [--json]`, "UNKNOWN_SUBCOMMAND");
  }

  const mineOnly = !getBoolArg("--all");

  let tickets: Ticket[];
  try {
    tickets = await fetchOpenTickets({ mineOnly });
  } catch (err) {
    if (err instanceof MissingConfigError) error(err.message, err.code);
    throw err;
  }

  if (getBoolArg("--json")) {
    success(tickets);
    return;
  }

  const scope = mineOnly ? "your open Notion tickets" : "all open Notion tickets";
  writeLine(`🎫 ${scope} (${tickets.length}):`);
  if (tickets.length === 0) {
    writeLine("  (none)");
    return;
  }
  for (const t of tickets) writeLine(renderLine(t));
}
