import assert from "node:assert/strict";
import test from "node:test";
import { validateSdef } from "../dist/validator.js";

function put(line, start, end, value, align = "left") {
  const width = end - start + 1;
  const v = value.length > width ? value.slice(0, width) : value;
  const filled = align === "right" ? v.padStart(width, " ") : v.padEnd(width, " ");
  for (let i = 0; i < width; i++) line[start - 1 + i] = filled[i];
}
function row(...fields) {
  const line = Array(132).fill(" ");
  for (const [s, e, v, a] of fields) put(line, s, e, v, a ?? "left");
  return line.join("").trimEnd();
}

const lines = [
  row([1,4,"VOLM"],[6,7,"1","right"]),
  row([1,4,"PROJ"],[6,12,"12Aug26"],[14,17,"A001"],[19,66,"Demo Federal Project"],[68,103,"Example Contractor"],[105,105,"P"],[107,112,"260001"],[114,120,"01Aug26"],[122,128,"31Dec26"]),
  row([1,4,"CLDR"],[6,6,"1"],[8,14,"NYYYYYN"],[16,45,"Five Day Week"]),
  row([1,4,"ACTV"],[6,15,"1000","right"],[17,46,"Mobilize"],[48,50,"10","right"],[63,63,"1"],[67,69,"5","right"],[71,74,"GC"],[76,79,"SITE"],[88,93,"000001"],[95,96,"01"],[98,98,"C"],[100,128,"Mobilization"]),
  row([1,4,"ACTV"],[6,15,"1010","right"],[17,46,"Excavate"],[48,50,"5","right"],[63,63,"1"],[67,69,"8","right"],[71,74,"EXC"],[76,79,"SITE"],[88,93,"000001"],[95,96,"01"],[98,98,"C"],[100,128,"Earthwork"]),
  row([1,4,"PRED"],[6,15,"1010","right"],[17,26,"1000","right"],[28,28,"C"],[30,33,"0","right"]),
  row([1,4,"PROG"],[6,15,"1000","right"],[17,23,"01Aug26"],[33,35,"4","right"],[37,48,"1000.00","right"],[50,61,"600.00","right"],[63,74,"0.00","right"],[84,90,"18Aug26"],[100,106,"19Aug26"],[108,108,"+"],[110,112,"1","right"]),
  row([1,4,"PROG"],[6,15,"1010","right"],[33,35,"5","right"],[37,48,"2500.00","right"],[50,61,"0.00","right"],[63,74,"0.00","right"],[76,82,"19Aug26"],[84,90,"25Aug26"],[92,98,"20Aug26"],[100,106,"26Aug26"],[108,108,"+"],[110,112,"1","right"]),
  "END",
];
const good = lines.join("\r\n");

test("accepts a structurally valid SDEF fixture", () => {
  const r = validateSdef(good);
  assert.equal(r.errors, 0, JSON.stringify(r.diagnostics, null, 2));
  assert.equal(r.summary.activities, 2);
  assert.equal(r.summary.relationships, 1);
});

test("catches the QCS four-character project identifier failure", () => {
  const badLines = [...lines];
  badLines[1] = badLines[1].slice(0, 13) + "A01 " + badLines[1].slice(17);
  const r = validateSdef(badLines.join("\r\n"));
  assert.ok(r.diagnostics.some((d) => d.code === "PROJECT_ID_LENGTH" && d.severity === "error"));
});

test("catches unknown calendar references", () => {
  const badLines = [...lines];
  const chars = badLines[3].padEnd(132, " ").split("");
  chars[62] = "9"; // column 63
  badLines[3] = chars.join("").trimEnd();
  const r = validateSdef(badLines.join("\r\n"));
  assert.ok(r.diagnostics.some((d) => d.code === "UNKNOWN_ACTIVITY_CALENDAR"));
});
