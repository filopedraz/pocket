/**
 * pocket briefing [--to <dest>] [--dry-run] — compose a short, friendly
 * morning briefing in Italian from the repo-root `todos.md` and post it to
 * Slack.
 *
 * It parses the first "## Oggi (DATE)" section of todos.md, renders the
 * checkbox items (⬜ todo · 🔄 in progress · ✅ done), and sends the result
 * to a Slack destination. Destination resolves from `--to`, then
 * $SLACK_BRIEFING_TARGET (no value is hardcoded — keep personal IDs in .env).
 *
 * Use `--dry-run` to print the composed briefing instead of posting — handy
 * for testing without spamming Slack.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getArg, getBoolArg } from "../lib/args";
import { fetchOpenTickets, type Ticket } from "../lib/notion";
import { error, success, writeLine } from "../lib/output";
import { resolveRoot } from "../lib/paths";
import { MissingTokenError, postSlack } from "../lib/slack";

type Status = "todo" | "doing" | "done";

interface TodoItem {
  status: Status;
  text: string;
}

const MARKER: Record<Status, string> = {
  todo: "⬜",
  doing: "🔄",
  done: "✅",
};

/** Parse the first "## Oggi" section into a date (if any) + its items. */
function parseOggi(markdown: string): { date?: string; items: TodoItem[] } {
  const lines = markdown.split("\n");
  let inSection = false;
  let date: string | undefined;
  const items: TodoItem[] = [];

  for (const line of lines) {
    const heading = line.match(/^##\s+(.*)$/);
    if (heading) {
      if (inSection) break; // next "## " heading ends the Oggi section
      const title = heading[1]!.trim();
      if (/^Oggi\b/i.test(title)) {
        inSection = true;
        const dateMatch = title.match(/\(([^)]*)\)/);
        if (dateMatch) date = dateMatch[1]!.trim();
      }
      continue;
    }

    if (!inSection) continue;

    const checkbox = line.match(/^\s*-\s*\[([ x~])\]\s*(.*)$/i);
    if (!checkbox) continue;

    const text = checkbox[2]!.trim();
    if (!text || text.includes("_(vuoto")) continue; // skip placeholder/empty

    const mark = checkbox[1]!.toLowerCase();
    const status: Status = mark === "x" ? "done" : mark === "~" ? "doing" : "todo";
    items.push({ status, text });
  }

  return { date, items };
}

function composeBriefing(date: string | undefined, items: TodoItem[]): string {
  const header = date ? `Buongiorno! ☀️ Ecco il tuo briefing del ${date}:` : "Buongiorno! ☀️ Ecco il tuo briefing:";

  let body: string;
  let closing: string;
  if (items.length === 0) {
    body = "Nessun to-do per oggi — giornata libera (o da riempire 😉).";
    closing = "Buona giornata!";
  } else {
    body = items.map((it) => `${MARKER[it.status]} ${it.text}`).join("\n");
    const done = items.filter((it) => it.status === "done").length;
    closing = done === items.length ? "Tutto fatto, gran lavoro! 🎉" : "Forza, si parte! 💪";
  }

  return `${header}\n\n${body}\n\n${closing}\nAlfredhino`;
}

const PRIORITY_EMOJI: Record<string, string> = {
  Urgent: "🔴",
  High: "🟠",
  Mid: "🟡",
  Low: "⚪",
};

const MAX_TICKETS = 8;

/**
 * Render a "🎫 Ticket Notion aperti:" block from the user's open tickets,
 * or null when there are none (so the caller can omit the section entirely).
 */
function composeTickets(tickets: Ticket[]): string | null {
  if (tickets.length === 0) return null;
  const lines = tickets.slice(0, MAX_TICKETS).map((t) => {
    let line = `${PRIORITY_EMOJI[t.priority] ?? "⚫"} ${t.name} (${t.status || "?"})`;
    if (t.due) line += ` · ${t.due}`;
    return line;
  });
  const more = tickets.length > MAX_TICKETS ? `\n…e altri ${tickets.length - MAX_TICKETS}.` : "";
  return `🎫 Ticket Notion aperti:\n${lines.join("\n")}${more}`;
}

export async function run() {
  const root = resolveRoot();
  const todosPath = join(root, "todos.md");
  if (!existsSync(todosPath)) {
    error("todos.md not found at repo root — run nothing or create it", "NO_TODOS");
  }

  const markdown = readFileSync(todosPath, "utf-8");
  const { date, items } = parseOggi(markdown);
  let text = composeBriefing(date, items);

  // Augment with the user's open Notion tickets. Best-effort: if Notion
  // isn't configured or the API errors, silently skip the section so the
  // to-do briefing still goes out.
  try {
    const tickets = await fetchOpenTickets({ mineOnly: true });
    const ticketSection = composeTickets(tickets);
    if (ticketSection) {
      // Insert the tickets block before the closing line + signature.
      const signature = "\nAlfredhino";
      if (text.endsWith(signature)) {
        const head = text.slice(0, -signature.length);
        const lastBreak = head.lastIndexOf("\n\n");
        if (lastBreak !== -1) {
          const beforeClosing = head.slice(0, lastBreak);
          const closing = head.slice(lastBreak + 2);
          text = `${beforeClosing}\n\n${ticketSection}\n\n${closing}${signature}`;
        } else {
          text = `${text}\n\n${ticketSection}`;
        }
      } else {
        text = `${text}\n\n${ticketSection}`;
      }
    }
  } catch {
    // Missing config or API error — skip the tickets section silently.
  }

  if (getBoolArg("--dry-run")) {
    writeLine(text);
    return;
  }

  const channel = getArg("--to") ?? process.env.SLACK_BRIEFING_TARGET;
  if (!channel) {
    error("no destination: pass --to <channel|userId> or set SLACK_BRIEFING_TARGET in .env", "MISSING_DEST");
  }

  let result: Awaited<ReturnType<typeof postSlack>>;
  try {
    result = await postSlack({ channel: channel as string, text });
  } catch (err) {
    if (err instanceof MissingTokenError) error(err.message, err.code);
    throw err;
  }

  if (!result.ok) {
    const detail = result.messages?.length ? `: ${result.messages.join("; ")}` : "";
    error(`Slack API error: ${result.error ?? "unknown_error"}${detail}`, "SLACK_ERROR");
  }

  success({ ok: true, channel: result.channel, ts: result.ts, items: items.length });
}
