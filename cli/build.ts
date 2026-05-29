#!/usr/bin/env bun

import { $ } from "bun";

console.log("Building pocket CLI...");

await $`bun build src/index.ts --compile --outfile dist/pocket`;

console.log("Done! Binary at: cli/dist/pocket");
