/**
 * Output helpers. `recent`/`doctor` are human-facing tables; the rest of
 * the commands print JSON to stdout on success and JSON to stderr on
 * error, so agents can pipe through `jq`.
 */

export function success(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`, () => process.exit(0));
}

export function error(msg: string, code?: string): never {
  process.stderr.write(`${JSON.stringify({ error: msg, ...(code ? { code } : {}) })}\n`);
  process.exit(1);
}

export function writeLine(line: string): void {
  process.stdout.write(`${line}\n`);
}
