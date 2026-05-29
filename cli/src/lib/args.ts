/**
 * Minimal argument parsing. No external CLI framework.
 *
 * Convention: `pocket <command> [positional...] [--flag value] [--bool]`.
 */

const argv = process.argv.slice(2);

export function getCommand(): { command: string; rest: string[] } {
  return {
    command: argv[0] ?? "",
    rest: argv.slice(1),
  };
}

/** First non-flag positional after the command, ignoring the command itself. */
export function getPositional(index: number): string | undefined {
  const positionals: string[] = [];
  for (let i = 1; i < argv.length; i++) {
    const token = argv[i]!;
    if (token.startsWith("--")) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) i++;
      continue;
    }
    positionals.push(token);
  }
  return positionals[index];
}

export function getArg(flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= argv.length) return undefined;
  return argv[idx + 1];
}

export function getBoolArg(flag: string): boolean {
  return argv.includes(flag);
}
