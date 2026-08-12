import { RECORD_SPECS } from "./spec.js";
import type { ParsedRecord, SdefDocument } from "./types.js";

function recordKind(line: string): string {
  if (line.startsWith("END")) return "END";
  return line.slice(0, 4).trim().toUpperCase();
}

function slice1(line: string, start: number, end: number): string {
  return line.slice(start - 1, end);
}

export function parseSdef(input: string): SdefDocument {
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  // Preserve deliberate blank lines; only discard the final empty item caused by a terminal newline.
  const lines = normalized.endsWith("\n") ? normalized.slice(0, -1).split("\n") : normalized.split("\n");
  const records: ParsedRecord[] = lines.map((raw, index) => {
    const kind = recordKind(raw);
    const spec = RECORD_SPECS[kind];
    const fields: Record<string, string> = {};
    if (spec) {
      for (const field of spec.fields) {
        fields[field.name] = slice1(raw, field.start, field.end).trim();
      }
    }
    return { line: index + 1, kind, raw, fields };
  });

  const byKind = new Map<string, ParsedRecord[]>();
  for (const record of records) {
    const bucket = byKind.get(record.kind) ?? [];
    bucket.push(record);
    byKind.set(record.kind, bucket);
  }
  return { records, byKind };
}
