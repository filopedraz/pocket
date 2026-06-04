/**
 * Shared Notion helper. Wraps the REST API `databases/{id}/query` endpoint
 * so multiple commands (`notion`, `briefing`, …) can read tickets without
 * duplicating fetch/auth/parse/paginate logic.
 *
 * Auth uses $NOTION_TOKEN (an internal integration token) and queries the
 * database identified by $NOTION_TICKETS_DB. Optionally scopes to the
 * current user via $NOTION_USER_ID.
 *
 * This module deliberately does NOT call into the output helpers
 * (success/error). It returns plain data and lets the caller decide how to
 * report. The one exception is the missing-config case, which throws a typed
 * `MissingConfigError` so callers can surface a clear message.
 */

export class MissingConfigError extends Error {
  readonly code = "MISSING_NOTION_CONFIG";
  constructor(message: string) {
    super(message);
    this.name = "MissingConfigError";
  }
}

export interface Ticket {
  id: string;
  name: string;
  status: string;
  priority: string;
  type: string;
  assignees: string[];
  due: string | null;
  url: string;
}

const NOTION_VERSION = "2022-06-28";

// Priority ranking: higher first. Unknown priorities sort last.
const PRIORITY_RANK: Record<string, number> = {
  Urgent: 0,
  High: 1,
  Mid: 2,
  Low: 3,
};

function priorityRank(p: string): number {
  return PRIORITY_RANK[p] ?? Number.MAX_SAFE_INTEGER;
}

// Minimal shapes for the bits of the Notion page we read.
interface NotionRichText {
  plain_text?: string;
}
interface NotionPerson {
  name?: string;
}
interface NotionProperty {
  title?: NotionRichText[];
  status?: { name?: string } | null;
  select?: { name?: string } | null;
  people?: NotionPerson[];
  date?: { start?: string | null } | null;
}
interface NotionPage {
  id: string;
  url: string;
  properties: Record<string, NotionProperty>;
}
interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
  object?: string;
  message?: string;
}

function mapPage(page: NotionPage): Ticket {
  const props = page.properties ?? {};

  const titleProp = props.Name?.title ?? [];
  const name = titleProp
    .map((t) => t.plain_text ?? "")
    .join("")
    .trim();

  const status = props.Status?.status?.name ?? "";
  const priority = props.Priority?.select?.name ?? "";
  const type = props.Type?.select?.name ?? "";
  const assignees = (props.Assign?.people ?? []).map((p) => p.name ?? "").filter((n) => n.length > 0);
  const due = props["Due Date"]?.date?.start ?? null;

  return {
    id: page.id,
    name: name || "(untitled)",
    status,
    priority,
    type,
    assignees,
    due,
    url: page.url,
  };
}

function sortTickets(tickets: Ticket[]): Ticket[] {
  return tickets.sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    // Due date ascending, nulls last.
    if (a.due === null && b.due === null) return 0;
    if (a.due === null) return 1;
    if (b.due === null) return -1;
    return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
  });
}

export async function fetchOpenTickets(opts?: { mineOnly?: boolean }): Promise<Ticket[]> {
  const token = process.env.NOTION_TOKEN;
  const db = process.env.NOTION_TICKETS_DB;
  if (!token || !db) {
    const missing = [!token && "NOTION_TOKEN", !db && "NOTION_TICKETS_DB"].filter(Boolean).join(" and ");
    throw new MissingConfigError(
      `missing Notion config: add ${missing} to .env (integration token from https://www.notion.so/my-integrations and the M&S Tickets database id)`,
    );
  }

  // Exclude Done and Archived. Optionally scope to the current user.
  const andFilters: unknown[] = [
    { property: "Status", status: { does_not_equal: "Done" } },
    { property: "Status", status: { does_not_equal: "Archived" } },
  ];

  if (opts?.mineOnly && process.env.NOTION_USER_ID) {
    andFilters.push({ property: "Assign", people: { contains: process.env.NOTION_USER_ID } });
  }

  const filter = { and: andFilters };

  const collected: Ticket[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { filter, page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${db}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as NotionQueryResponse;

    if (!res.ok || data.object === "error") {
      throw new Error(`Notion API error: ${data.message ?? res.statusText ?? "unknown_error"}`);
    }

    for (const page of data.results ?? []) collected.push(mapPage(page));

    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);

  return sortTickets(collected);
}
