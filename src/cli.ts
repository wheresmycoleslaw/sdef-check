#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { validateSdef } from "./validator.js";

function usage(): never {
  console.error("Usage: sdef-check <schedule.sdef> [--json] [--no-p6-interop]");
  process.exit(2);
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) usage();
const json = args.includes("--json");
const p6Interop = !args.includes("--no-p6-interop");

try {
  const data = await readFile(file);
  // Latin-1 maps bytes 1:1 so non-ASCII bytes survive validation instead of being replaced.
  const text = data.toString("latin1");
  const result = validateSdef(text, { p6Interop });
  if (json) {
    console.log(JSON.stringify({
      file,
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      summary: result.summary,
      diagnostics: result.diagnostics,
    }, null, 2));
  } else {
    const mark = result.valid ? "PASS" : "FAIL";
    console.log(`${mark} ${basename(file)} — ${result.errors} error(s), ${result.warnings} warning(s)`);
    console.log(`${result.summary.activities} activities · ${result.summary.relationships} relationships · ${result.summary.calendars} calendars · ${result.summary.lines} records`);
    for (const d of result.diagnostics) {
      const where = d.line ? `line ${d.line}${d.field ? `, ${d.field}` : ""}` : "file";
      console.log(`${d.severity.toUpperCase().padEnd(7)} ${d.code} (${where}): ${d.message}`);
      if (d.suggestion) console.log(`        fix: ${d.suggestion}`);
    }
  }
  process.exitCode = result.valid ? 0 : 1;
} catch (error) {
  console.error(`sdef-check: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
