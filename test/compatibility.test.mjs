import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateSdef } from "../dist/validator.js";

function put(line, start, end, value, align = "left") {
  const width = end - start + 1;
  const v = String(value).length > width ? String(value).slice(0, width) : String(value);
  const filled = align === "right" ? v.padStart(width, " ") : v.padEnd(width, " ");
  for (let i = 0; i < width; i++) line[start - 1 + i] = filled[i];
}

function row(...fields) {
  const line = Array(132).fill(" ");
  for (const [s, e, v, a] of fields) put(line, s, e, v, a ?? "left");
  return line.join("").trimEnd();
}

function baseDocument({
  calendarCode = "A",
  duration = "5",
  featureOfWork = "General",
  projectId = "A001",
  workersPerDay = "0",
  floatSign = "",
} = {}) {
  return [
    row([1, 4, "VOLM"], [6, 7, "1", "right"]),
    row([1, 4, "PROJ"], [6, 12, "01Mar19"], [14, 17, projectId], [19, 66, "Compatibility Fixture"], [68, 103, "Example Contractor"], [105, 105, "A"], [107, 112, "TEST01"], [114, 120, "01Jan19"], [122, 128, "31Dec20"]),
    row([1, 4, "CLDR"], [6, 6, calendarCode], [8, 14, "NYYYYYN"], [16, 45, "Five Day Week"]),
    row([1, 4, "ACTV"], [6, 15, "A100", "right"], [17, 46, "Compatibility Activity"], [48, 50, duration, "right"], [63, 63, calendarCode], [67, 69, workersPerDay, "right"], [71, 74, "GEN"], [76, 79, "SITE"], [88, 93, "000001"], [95, 96, "01"], [98, 98, "C"], [100, 128, featureOfWork]),
    row([1, 4, "PROG"], [6, 15, "A100", "right"], [33, 35, duration, "right"], [37, 48, "0.00", "right"], [50, 61, "0.00", "right"], [63, 74, "0.00", "right"], [76, 82, "02Mar19"], [84, 90, "08Mar19"], [92, 98, "02Mar19"], [100, 106, "08Mar19"], [108, 108, floatSign], [110, 112, "0", "right"]),
    "END",
  ];
}

test("accepts the sanitized real-world-derived P6 closeout fixture", () => {
  const input = readFileSync(new URL("./fixtures/real-world-derived.sdef", import.meta.url), "utf8");
  const r = validateSdef(input);
  assert.equal(r.errors, 0, JSON.stringify(r.diagnostics, null, 2));
  assert.equal(r.summary.activities, 6);
  assert.equal(r.summary.relationships, 5);
});

test("P6/QCS mode accepts an unstarted zero-duration milestone", () => {
  const input = baseDocument({ duration: "0" }).join("\r\n");
  const r = validateSdef(input);
  assert.equal(r.errors, 0, JSON.stringify(r.diagnostics, null, 2));
  assert.ok(!r.diagnostics.some((d) => d.code === "ZERO_REMAINING_WITHOUT_FINISH"));
});

test("core Appendix A mode rejects zero remaining duration without actual finish", () => {
  const input = baseDocument({ duration: "0" }).join("\r\n");
  const r = validateSdef(input, { p6Interop: false });
  assert.ok(r.diagnostics.some((d) => d.code === "ZERO_REMAINING_WITHOUT_FINISH" && d.severity === "error"));
});

test("P6/QCS mode requires exactly four project-ID characters", () => {
  const input = baseDocument({ projectId: "A01" }).join("\r\n");
  const r = validateSdef(input);
  assert.ok(r.diagnostics.some((d) => d.code === "PROJECT_ID_LENGTH" && d.severity === "error"));
});

test("core Appendix A mode allows project IDs shorter than four characters", () => {
  const input = baseDocument({ projectId: "A01" }).join("\r\n");
  const r = validateSdef(input, { p6Interop: false });
  assert.ok(!r.diagnostics.some((d) => d.code === "PROJECT_ID_LENGTH"));
});

test("P6/QCS mode requires Workers Per Day", () => {
  const input = baseDocument({ workersPerDay: "" }).join("\r\n");
  const r = validateSdef(input);
  assert.ok(r.diagnostics.some((d) => d.code === "WORKERS_PER_DAY_REQUIRED" && d.severity === "error"));
});

test("core Appendix A mode leaves Workers Per Day project-specification dependent", () => {
  const input = baseDocument({ workersPerDay: "" }).join("\r\n");
  const r = validateSdef(input, { p6Interop: false });
  assert.ok(!r.diagnostics.some((d) => d.code === "WORKERS_PER_DAY_REQUIRED"));
});

test("rejects calendar codes outside P6 A-Z and 0-9", () => {
  const input = baseDocument({ calendarCode: "!" }).join("\r\n");
  const r = validateSdef(input);
  assert.ok(r.diagnostics.some((d) => d.code === "P6_CALENDAR_CODE" && d.severity === "error"));
});

test("rejects more than 36 distinct calendars for P6 interoperability", () => {
  const lines = baseDocument();
  lines.splice(2, 1);
  const codes = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!";
  const calendars = [...codes].map((code) => row([1, 4, "CLDR"], [6, 6, code], [8, 14, "NYYYYYN"], [16, 45, `Calendar ${code}`]));
  lines.splice(2, 0, ...calendars);
  const r = validateSdef(lines.join("\r\n"));
  assert.ok(r.diagnostics.some((d) => d.code === "P6_CALENDAR_LIMIT" && d.severity === "error"));
});

test("warns when modern P6 Feature of Work exceeds 20 characters", () => {
  const input = baseDocument({ featureOfWork: "123456789012345678901" }).join("\r\n");
  const r = validateSdef(input);
  assert.ok(r.diagnostics.some((d) => d.code === "P6_FOW_LENGTH" && d.severity === "warning"));
});

test("rejects locale-style comma decimals in SDEF numeric fields", () => {
  const lines = baseDocument();
  lines.splice(4, 0, row([1, 4, "UNIT"], [6, 15, "A100", "right"], [17, 29, "1,0000", "right"], [31, 43, "1.0000", "right"], [45, 57, "0.0000", "right"], [59, 61, "EA"]));
  const r = validateSdef(lines.join("\r\n"));
  assert.ok(r.diagnostics.some((d) => d.code === "INVALID_DECIMAL_8_4" && d.severity === "error"));
});

test("detects activity ID collisions after P6's ten-character SDEF truncation", () => {
  const lines = baseDocument();
  const duplicateActivity = row([1, 4, "ACTV"], [6, 15, "A100", "right"], [17, 46, "Second Activity"], [48, 50, "5", "right"], [63, 63, "A"], [67, 69, "0", "right"]);
  const duplicateProgress = row([1, 4, "PROG"], [6, 15, "A100", "right"], [33, 35, "5", "right"], [37, 48, "0.00", "right"], [50, 61, "0.00", "right"], [63, 74, "0.00", "right"], [76, 82, "02Mar19"], [84, 90, "08Mar19"], [92, 98, "02Mar19"], [100, 106, "08Mar19"], [110, 112, "0", "right"]);
  lines.splice(4, 0, duplicateActivity);
  lines.splice(lines.length - 1, 0, duplicateProgress);
  const r = validateSdef(lines.join("\r\n"));
  assert.ok(r.diagnostics.some((d) => d.code === "DUPLICATE_ACTIVITY" && d.severity === "error"));
});

test("keeps Appendix A month abbreviations case-sensitive", () => {
  const input = baseDocument().join("\r\n").replace("01Mar19", "01MAR19");
  const r = validateSdef(input);
  assert.ok(r.diagnostics.some((d) => d.code === "INVALID_DATE" && d.severity === "error"));
});

test("keeps Appendix A zero-float sign blank", () => {
  const input = baseDocument({ floatSign: "+" }).join("\r\n");
  const r = validateSdef(input);
  assert.ok(r.diagnostics.some((d) => d.code === "ZERO_FLOAT_SIGN" && d.severity === "error"));
});
