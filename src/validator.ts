import { parseSdef } from "./parser.js";
import { RECORD_ORDER, RECORD_SPECS, type FieldSpec } from "./spec.js";
import type { Diagnostic, ParsedRecord, ValidationOptions, ValidationResult } from "./types.js";

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

interface DateParts { year: number; month: number; day: number }

function dateParts(value: string): DateParts | null {
  const m = /^(\d{2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{2})$/.exec(value);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2]!]!;
  const yy = Number(m[3]);
  // SDEF only stores two digits. Pivot solely for internal ordering checks.
  const year = yy >= 70 ? 1900 + yy : 2000 + yy;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { year, month, day };
}

function dateScalar(value: string): number | null {
  const p = dateParts(value);
  return p ? p.year * 10000 + p.month * 100 + p.day : null;
}

function rawField(record: ParsedRecord, field: FieldSpec): string {
  return record.raw.slice(field.start - 1, field.end);
}

function diagnostic(
  diagnostics: Diagnostic[],
  severity: Diagnostic["severity"],
  code: string,
  message: string,
  record?: ParsedRecord,
  field?: FieldSpec,
  suggestion?: string,
): void {
  const d: Diagnostic = { severity, code, message };
  if (record) {
    d.line = record.line;
    d.record = record.kind || "UNKNOWN";
  }
  if (field) {
    d.field = field.name;
    d.columns = [field.start, field.end];
  }
  if (suggestion) d.suggestion = suggestion;
  diagnostics.push(d);
}

function validateField(diagnostics: Diagnostic[], record: ParsedRecord, field: FieldSpec): void {
  const raw = rawField(record, field);
  const value = raw.trim();
  if (field.required && value.length === 0) {
    diagnostic(diagnostics, "error", "REQUIRED_FIELD", `${field.name} is required.`, record, field);
    return;
  }
  if (!value) return;

  switch (field.type) {
    case "integer":
      if (!/^-?\d+$/.test(value)) diagnostic(diagnostics, "error", "INVALID_INTEGER", `${field.name} must be a whole number; found ${JSON.stringify(value)}.`, record, field);
      break;
    case "date":
      if (!dateParts(value)) diagnostic(diagnostics, "error", "INVALID_DATE", `${field.name} must be a real date in ddmmmyy form (for example 01Mar99); found ${JSON.stringify(value)}.`, record, field);
      break;
    case "workdays":
      if (!/^[YN]{7}$/.test(value)) diagnostic(diagnostics, "error", "INVALID_WORKWEEK", `${field.name} must contain exactly seven Y/N flags, Sunday through Saturday.`, record, field);
      break;
    case "decimal4":
      if (!/^-?\d{1,8}\.\d{4}$/.test(value)) diagnostic(diagnostics, "error", "INVALID_DECIMAL_8_4", `${field.name} must use SDEF 8.4 format, including four decimal places.`, record, field);
      break;
    case "decimal2":
      if (!/^-?\d{1,9}\.\d{2}$/.test(value)) diagnostic(diagnostics, "error", "INVALID_DECIMAL_9_2", `${field.name} must use SDEF 9.2 format, including two decimal places.`, record, field);
      break;
    case "enum":
      if (field.allowed && !field.allowed.includes(value)) diagnostic(diagnostics, "error", "INVALID_ENUM", `${field.name} must be one of ${field.allowed.join(", ")}; found ${JSON.stringify(value)}.`, record, field);
      break;
  }

  if (field.align === "right" && raw.length > 0 && /\s$/.test(raw) && value) {
    diagnostic(diagnostics, "warning", "RIGHT_JUSTIFICATION", `${field.name} should be right-justified within columns ${field.start}-${field.end}.`, record, field);
  }
  if (field.align === "left" && raw.length > 0 && /^\s/.test(raw) && value) {
    diagnostic(diagnostics, "warning", "LEFT_JUSTIFICATION", `${field.name} should be left-justified within columns ${field.start}-${field.end}.`, record, field);
  }
}

function checkSeparators(diagnostics: Diagnostic[], record: ParsedRecord): void {
  const spec = RECORD_SPECS[record.kind];
  if (!spec || spec.fields.length < 2) return;
  for (let i = 0; i < spec.fields.length - 1; i++) {
    const a = spec.fields[i]!;
    const b = spec.fields[i + 1]!;
    if (b.start <= a.end + 1) continue;
    const between = record.raw.slice(a.end, b.start - 1);
    if (between && /[^ ]/.test(between)) {
      diagnostic(
        diagnostics,
        "error",
        "FIELD_SEPARATOR",
        `Columns ${a.end + 1}-${b.start - 1} between ${a.name} and ${b.name} must be blank.`,
        record,
        undefined,
        "A shifted field can make QCS interpret later dates or numbers in the wrong columns.",
      );
    }
  }
}

function numberValue(value: string): number | null {
  if (!/^-?\d+$/.test(value)) return null;
  return Number(value);
}

function recordsOf(byKind: Map<string, ParsedRecord[]>, kind: string): ParsedRecord[] {
  return byKind.get(kind) ?? [];
}

export function validateSdef(input: string, options: ValidationOptions = {}): ValidationResult {
  const enforce132Columns = options.enforce132Columns ?? true;
  const p6Interop = options.p6Interop ?? true;
  const diagnostics: Diagnostic[] = [];
  const document = parseSdef(input);
  const { records, byKind } = document;

  if (input.startsWith("\uFEFF")) {
    diagnostic(diagnostics, "error", "UTF8_BOM", "SDEF is ASCII fixed-width text; remove the UTF-8 BOM before the VOLM record.");
  }
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    if (c > 127 && c !== 0xfeff) {
      diagnostic(diagnostics, "error", "NON_ASCII", `Non-ASCII character U+${c.toString(16).toUpperCase().padStart(4, "0")} found; SDEF requires ASCII.`);
      break;
    }
  }

  if (records.length === 0 || (records.length === 1 && records[0]!.raw === "")) {
    diagnostic(diagnostics, "error", "EMPTY_FILE", "The file contains no SDEF records.");
  }

  const order = new Map<string, number>(RECORD_ORDER.map((id, i) => [id, i]));
  let maxSeen = -1;
  for (const record of records) {
    if (record.raw.length === 0) {
      diagnostic(diagnostics, "error", "BLANK_LINE", "SDEF files must not contain blank lines.", record);
      continue;
    }
    if (enforce132Columns && record.raw.length > 132) {
      diagnostic(diagnostics, "error", "LINE_TOO_LONG", `Record is ${record.raw.length} characters; the SDEF envelope is 132 columns.`, record);
    }
    if (!RECORD_SPECS[record.kind]) {
      diagnostic(diagnostics, "error", "UNKNOWN_RECORD", `Unknown record identifier ${JSON.stringify(record.raw.slice(0, 4))}.`, record);
      continue;
    }
    const rank = order.get(record.kind)!;
    if (rank < maxSeen) {
      diagnostic(diagnostics, "error", "RECORD_ORDER", `${record.kind} is out of SDEF sequence.`, record, undefined, `Expected records to follow ${RECORD_ORDER.join(" → ")}, with optional groups omitted when unused.`);
    } else {
      maxSeen = rank;
    }
    const spec = RECORD_SPECS[record.kind]!;
    for (const field of spec.fields) validateField(diagnostics, record, field);
    checkSeparators(diagnostics, record);
  }

  if (records[0]?.kind !== "VOLM") diagnostic(diagnostics, "error", "FIRST_RECORD", "The first record must be VOLM.", records[0]);
  if (records[1]?.kind !== "PROJ") diagnostic(diagnostics, "error", "SECOND_RECORD", "The second record must be PROJ.", records[1]);
  if (records.at(-1)?.kind !== "END") diagnostic(diagnostics, "error", "LAST_RECORD", "The last record must be END.", records.at(-1));
  if (recordsOf(byKind, "VOLM").length !== 1) diagnostic(diagnostics, "error", "VOLM_COUNT", "A single-file SDEF document must contain exactly one VOLM record.");
  if (recordsOf(byKind, "PROJ").length !== 1) diagnostic(diagnostics, "error", "PROJ_COUNT", "SDEF must contain exactly one PROJ record.");
  if (recordsOf(byKind, "CLDR").length < 1) diagnostic(diagnostics, "error", "CALENDAR_REQUIRED", "SDEF requires at least one CLDR record.");
  if (recordsOf(byKind, "ACTV").length < 1) diagnostic(diagnostics, "error", "ACTIVITY_REQUIRED", "SDEF requires at least one ACTV record.");
  if (recordsOf(byKind, "END").length !== 1) diagnostic(diagnostics, "error", "END_COUNT", "SDEF must contain exactly one END record.");

  const proj = recordsOf(byKind, "PROJ")[0];
  if (proj) {
    const id = proj.fields.projectIdentifier ?? "";
    if (id.length !== 4) {
      diagnostic(
        diagnostics,
        "error",
        "PROJECT_ID_LENGTH",
        `Project Identifier must occupy exactly four characters for QCS interoperability; found ${id.length}.`,
        proj,
        RECORD_SPECS.PROJ!.fields.find((x) => x.name === "projectIdentifier"),
        "Pad or change the project ID to four characters before generating/importing SDEF; a short value shifts later fixed-width fields in broken exports.",
      );
    }
    const start = dateScalar(proj.fields.projectStart ?? "");
    const data = dateScalar(proj.fields.dataDate ?? "");
    const end = dateScalar(proj.fields.projectEnd ?? "");
    if (start && data && data < start) diagnostic(diagnostics, "error", "DATA_BEFORE_PROJECT", "Data Date is before Project Start.", proj);
    if (start && end && end < start) diagnostic(diagnostics, "error", "PROJECT_DATE_ORDER", "Project End is before Project Start.", proj);
    if (data && end && data > end) diagnostic(diagnostics, "warning", "DATA_AFTER_PROJECT", "Data Date is after Project End.", proj);
  }

  const calendars = recordsOf(byKind, "CLDR");
  const calendarCodes = new Set<string>();
  for (const rec of calendars) {
    const code = rec.fields.calendarCode ?? "";
    if (calendarCodes.has(code)) diagnostic(diagnostics, "error", "DUPLICATE_CALENDAR", `Calendar code ${JSON.stringify(code)} is defined more than once.`, rec);
    if (p6Interop && code && !/^[A-Z0-9]$/.test(code)) {
      diagnostic(
        diagnostics,
        "error",
        "P6_CALENDAR_CODE",
        `P6 SDEF calendar code ${JSON.stringify(code)} is invalid; use one uppercase letter A-Z or digit 0-9.`,
        rec,
      );
    }
    calendarCodes.add(code);
  }
  if (p6Interop && calendarCodes.size > 36) {
    diagnostic(diagnostics, "error", "P6_CALENDAR_LIMIT", `P6 SDEF workflows support at most 36 calendars; found ${calendarCodes.size}.`);
  }
  for (const rec of recordsOf(byKind, "HOLI")) {
    const code = rec.fields.calendarCode ?? "";
    if (!calendarCodes.has(code)) diagnostic(diagnostics, "error", "UNKNOWN_HOLIDAY_CALENDAR", `HOLI references undefined calendar ${JSON.stringify(code)}.`, rec);
  }

  const activities = recordsOf(byKind, "ACTV");
  if (p6Interop && activities.length > 10_000) diagnostic(diagnostics, "error", "P6_ACTIVITY_LIMIT", `SDEF/P6 conversion supports at most 10,000 activities; found ${activities.length}.`);
  const activityById = new Map<string, ParsedRecord>();
  for (const rec of activities) {
    const id = rec.fields.activityId ?? "";
    if (activityById.has(id)) diagnostic(diagnostics, "error", "DUPLICATE_ACTIVITY", `Activity ID ${JSON.stringify(id)} is duplicated.`, rec);
    activityById.set(id, rec);
    if (!calendarCodes.has(rec.fields.calendarCode ?? "")) diagnostic(diagnostics, "error", "UNKNOWN_ACTIVITY_CALENDAR", `Activity ${JSON.stringify(id)} references undefined calendar ${JSON.stringify(rec.fields.calendarCode)}.`, rec);
    const duration = numberValue(rec.fields.duration ?? "");
    if (duration !== null && (duration < 0 || duration > 999)) diagnostic(diagnostics, "error", "DURATION_RANGE", `Activity duration ${duration} is outside the SDEF 0–999 day range.`, rec);
    if (!(rec.fields.workersPerDay ?? "")) diagnostic(diagnostics, "error", "WORKERS_PER_DAY_REQUIRED", `Activity ${JSON.stringify(id)} must specify Workers Per Day; use 0 when there is no worker requirement.`, rec);
    const constraintDate = rec.fields.constraintDate ?? "";
    const constraintType = rec.fields.constraintType ?? "";
    if (Boolean(constraintDate) !== Boolean(constraintType)) diagnostic(diagnostics, "error", "CONSTRAINT_PAIR", "Constraint Date and Constraint Type must either both be present or both be blank.", rec);
    if (p6Interop && (rec.fields.featureOfWork ?? "").length > 20) {
      diagnostic(diagnostics, "warning", "P6_FOW_LENGTH", `Feature of Work is ${(rec.fields.featureOfWork ?? "").length} characters; modern P6 activity-code values are normally limited to 20 for SDEF workflows.`, rec);
    }
  }

  const predSeen = new Set<string>();
  for (const rec of recordsOf(byKind, "PRED")) {
    const id = rec.fields.activityId ?? "";
    const pred = rec.fields.predecessorId ?? "";
    if (!activityById.has(id)) diagnostic(diagnostics, "error", "UNKNOWN_SUCCESSOR", `PRED references unknown activity ${JSON.stringify(id)}.`, rec);
    if (!activityById.has(pred)) diagnostic(diagnostics, "error", "UNKNOWN_PREDECESSOR", `PRED references unknown predecessor ${JSON.stringify(pred)}.`, rec);
    if (id && id === pred) diagnostic(diagnostics, "error", "SELF_PREDECESSOR", `Activity ${JSON.stringify(id)} cannot precede itself.`, rec);
    const key = `${id}\u0000${pred}\u0000${rec.fields.predecessorType}`;
    if (predSeen.has(key)) diagnostic(diagnostics, "warning", "DUPLICATE_PREDECESSOR", `Duplicate relationship ${JSON.stringify(pred)} → ${JSON.stringify(id)}.`, rec);
    predSeen.add(key);
    const lag = numberValue(rec.fields.lagDuration ?? "");
    if (lag !== null && lag < 0) diagnostic(diagnostics, "warning", "NEGATIVE_LAG", "Negative lag is not broadly interoperable under SDEF and is discouraged by Appendix A.", rec);
  }
  if (proj?.fields.precedence === "P" && activities.length > 1 && recordsOf(byKind, "PRED").length === 0) {
    diagnostic(diagnostics, "error", "NO_PRECEDENCE_RECORDS", "Project uses precedence diagramming, so at least one PRED record is required when multiple activities are present.", proj);
  }

  const unitIds = new Set<string>();
  for (const rec of recordsOf(byKind, "UNIT")) {
    const id = rec.fields.activityId ?? "";
    if (!activityById.has(id)) diagnostic(diagnostics, "error", "UNKNOWN_UNIT_ACTIVITY", `UNIT references unknown activity ${JSON.stringify(id)}.`, rec);
    if (unitIds.has(id)) diagnostic(diagnostics, "error", "DUPLICATE_UNIT", `Activity ${JSON.stringify(id)} has more than one UNIT record; SDEF allows only one.`, rec);
    unitIds.add(id);
    if ((rec.fields.unitOfMeasure ?? "").toUpperCase() === "LS") diagnostic(diagnostics, "error", "LUMP_SUM_UNIT", "Lump-sum (LS) activities must not have UNIT records.", rec);
  }

  const progressById = new Map<string, ParsedRecord>();
  for (const rec of recordsOf(byKind, "PROG")) {
    const id = rec.fields.activityId ?? "";
    const act = activityById.get(id);
    if (!act) diagnostic(diagnostics, "error", "UNKNOWN_PROGRESS_ACTIVITY", `PROG references unknown activity ${JSON.stringify(id)}.`, rec);
    if (progressById.has(id)) diagnostic(diagnostics, "error", "DUPLICATE_PROGRESS", `Activity ${JSON.stringify(id)} has more than one PROG record.`, rec);
    progressById.set(id, rec);

    const actualStart = rec.fields.actualStart ?? "";
    const actualFinish = rec.fields.actualFinish ?? "";
    const remaining = numberValue(rec.fields.remainingDuration ?? "");
    const original = act ? numberValue(act.fields.duration ?? "") : null;
    const dataDate = proj ? dateScalar(proj.fields.dataDate ?? "") : null;
    const projectStart = proj ? dateScalar(proj.fields.projectStart ?? "") : null;
    const as = dateScalar(actualStart);
    const af = dateScalar(actualFinish);
    if (as && projectStart && as < projectStart) diagnostic(diagnostics, "error", "ACTUAL_START_BEFORE_PROJECT", `Actual Start for ${JSON.stringify(id)} is before Project Start.`, rec);
    if (as && dataDate && as > dataDate) diagnostic(diagnostics, "error", "ACTUAL_START_AFTER_DATA_DATE", `Actual Start for ${JSON.stringify(id)} is after the Data Date.`, rec);
    if (af && dataDate && af > dataDate) diagnostic(diagnostics, "error", "ACTUAL_FINISH_AFTER_DATA_DATE", `Actual Finish for ${JSON.stringify(id)} is after the Data Date.`, rec);
    if (as && af && af < as) diagnostic(diagnostics, "error", "ACTUAL_DATE_ORDER", `Actual Finish for ${JSON.stringify(id)} is before Actual Start.`, rec);

    if (actualStart) {
      if (rec.fields.earlyStart || rec.fields.lateStart) diagnostic(diagnostics, "error", "STARTED_DATE_FIELDS", `Started activity ${JSON.stringify(id)} must leave Early Start and Late Start blank.`, rec);
    } else {
      if (!rec.fields.earlyStart || !rec.fields.lateStart) diagnostic(diagnostics, "error", "UNSTARTED_DATE_FIELDS", `Unstarted activity ${JSON.stringify(id)} requires Early Start and Late Start.`, rec);
      if (remaining !== null && original !== null && remaining !== original) diagnostic(diagnostics, "error", "UNSTARTED_REMAINING", `Unstarted activity ${JSON.stringify(id)} must have Remaining Duration equal to Original Duration (${original}); found ${remaining}.`, rec);
    }

    if (actualFinish) {
      const shouldBlank = ["earlyStart", "lateStart", "earlyFinish", "lateFinish", "floatSign", "totalFloat"] as const;
      const populated = shouldBlank.filter((name) => Boolean(rec.fields[name]));
      if (populated.length) diagnostic(diagnostics, "error", "FINISHED_FIELDS", `Finished activity ${JSON.stringify(id)} must leave ${populated.join(", ")} blank.`, rec);
      if (remaining !== null && remaining !== 0) diagnostic(diagnostics, "error", "FINISHED_REMAINING", `Finished activity ${JSON.stringify(id)} must have Remaining Duration 0.`, rec);
    } else {
      if (!rec.fields.earlyFinish || !rec.fields.lateFinish) diagnostic(diagnostics, "error", "UNFINISHED_FINISH_FIELDS", `Unfinished activity ${JSON.stringify(id)} requires Early Finish and Late Finish.`, rec);
      if (remaining === 0 && original !== null && original > 0) diagnostic(diagnostics, "error", "ZERO_REMAINING_WITHOUT_FINISH", `Activity ${JSON.stringify(id)} has Remaining Duration 0 but no Actual Finish.`, rec);
    }

    const tf = numberValue(rec.fields.totalFloat ?? "");
    const sign = rec.fields.floatSign ?? "";
    if (!actualFinish) {
      if (tf === null) {
        diagnostic(diagnostics, "error", "MISSING_TOTAL_FLOAT", `Unfinished activity ${JSON.stringify(id)} must include Total Float.`, rec);
      } else {
        if (tf === 0 && sign) diagnostic(diagnostics, "error", "ZERO_FLOAT_SIGN", `Activity ${JSON.stringify(id)} has zero float, so Float Sign must be blank.`, rec);
        if (tf !== 0 && !sign) diagnostic(diagnostics, "error", "MISSING_FLOAT_SIGN", `Activity ${JSON.stringify(id)} has nonzero Total Float and must include + or - in Float Sign.`, rec);
      }
    }
  }
  for (const id of activityById.keys()) {
    if (!progressById.has(id)) diagnostic(diagnostics, "error", "MISSING_PROGRESS", `Activity ${JSON.stringify(id)} has no PROG record.`);
  }

  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;
  return {
    valid: errors === 0,
    errors,
    warnings,
    diagnostics,
    document,
    summary: {
      lines: records.length,
      activities: activities.length,
      calendars: calendars.length,
      relationships: recordsOf(byKind, "PRED").length,
      unitCosts: recordsOf(byKind, "UNIT").length,
      progressRecords: recordsOf(byKind, "PROG").length,
    },
  };
}
