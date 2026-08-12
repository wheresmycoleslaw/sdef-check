export type FieldType =
  | "text"
  | "identifier"
  | "integer"
  | "date"
  | "workdays"
  | "decimal4"
  | "decimal2"
  | "enum";

export interface FieldSpec {
  name: string;
  start: number;
  end: number;
  required?: boolean;
  type?: FieldType;
  allowed?: readonly string[];
  align?: "left" | "right";
}

export interface RecordSpec {
  id: string;
  fields: readonly FieldSpec[];
}

const f = (
  name: string,
  start: number,
  end: number,
  opts: Omit<FieldSpec, "name" | "start" | "end"> = {},
): FieldSpec => ({ name, start, end, ...opts });

export const RECORD_SPECS: Record<string, RecordSpec> = {
  VOLM: {
    id: "VOLM",
    fields: [
      f("recordIdentifier", 1, 4, { required: true, type: "enum", allowed: ["VOLM"] }),
      f("diskNumber", 6, 7, { required: true, type: "integer", align: "right" }),
    ],
  },
  PROJ: {
    id: "PROJ",
    fields: [
      f("recordIdentifier", 1, 4, { required: true, type: "enum", allowed: ["PROJ"] }),
      f("dataDate", 6, 12, { required: true, type: "date" }),
      f("projectIdentifier", 14, 17, { required: true, type: "identifier", align: "left" }),
      f("projectName", 19, 66, { required: true, type: "text", align: "left" }),
      f("contractorName", 68, 103, { required: true, type: "text", align: "left" }),
      f("precedence", 105, 105, { required: true, type: "enum", allowed: ["P", "A"] }),
      f("contractNumber", 107, 112, { required: true, type: "identifier", align: "left" }),
      f("projectStart", 114, 120, { required: true, type: "date" }),
      f("projectEnd", 122, 128, { required: true, type: "date" }),
    ],
  },
  CLDR: {
    id: "CLDR",
    fields: [
      f("recordIdentifier", 1, 4, { required: true, type: "enum", allowed: ["CLDR"] }),
      f("calendarCode", 6, 6, { required: true, type: "identifier" }),
      f("workdays", 8, 14, { required: true, type: "workdays" }),
      f("description", 16, 45, { required: true, type: "text", align: "left" }),
    ],
  },
  HOLI: {
    id: "HOLI",
    fields: [
      f("recordIdentifier", 1, 4, { required: true, type: "enum", allowed: ["HOLI"] }),
      f("calendarCode", 6, 6, { required: true, type: "identifier" }),
      ...Array.from({ length: 15 }, (_, i) => {
        const start = 8 + i * 8;
        return f(`holiday${i + 1}`, start, start + 6, { type: "date" });
      }),
    ],
  },
  ACTV: {
    id: "ACTV",
    fields: [
      f("recordIdentifier", 1, 4, { required: true, type: "enum", allowed: ["ACTV"] }),
      // Appendix A labels this as Integer, but current P6 workflows commonly use textual activity IDs.
      // Treat it as an opaque identifier and enforce width/uniqueness instead of inventing a false rejection.
      f("activityId", 6, 15, { required: true, type: "identifier", align: "right" }),
      f("description", 17, 46, { required: true, type: "text", align: "left" }),
      f("duration", 48, 50, { required: true, type: "integer", align: "right" }),
      f("constraintDate", 52, 58, { type: "date" }),
      f("constraintType", 60, 61, { type: "enum", allowed: ["ES", "LF"] }),
      f("calendarCode", 63, 63, { required: true, type: "identifier" }),
      f("hammockCode", 65, 65, { type: "enum", allowed: ["Y"] }),
      f("workersPerDay", 67, 69, { type: "integer", align: "right" }),
      f("responsibilityCode", 71, 74, { type: "text", align: "left" }),
      f("workAreaCode", 76, 79, { type: "text", align: "left" }),
      f("modOrClaimNumber", 81, 86, { type: "text", align: "left" }),
      f("bidItem", 88, 93, { type: "text", align: "left" }),
      f("phaseOfWork", 95, 96, { type: "text", align: "left" }),
      f("categoryOfWork", 98, 98, { type: "text" }),
      f("featureOfWork", 100, 128, { type: "text", align: "left" }),
    ],
  },
  PRED: {
    id: "PRED",
    fields: [
      f("recordIdentifier", 1, 4, { required: true, type: "enum", allowed: ["PRED"] }),
      f("activityId", 6, 15, { required: true, type: "identifier", align: "right" }),
      f("predecessorId", 17, 26, { required: true, type: "identifier", align: "right" }),
      f("predecessorType", 28, 28, { required: true, type: "enum", allowed: ["S", "F", "C"] }),
      f("lagDuration", 30, 33, { required: true, type: "integer", align: "right" }),
    ],
  },
  UNIT: {
    id: "UNIT",
    fields: [
      f("recordIdentifier", 1, 4, { required: true, type: "enum", allowed: ["UNIT"] }),
      f("activityId", 6, 15, { required: true, type: "identifier", align: "right" }),
      f("totalQuantity", 17, 29, { required: true, type: "decimal4", align: "right" }),
      f("costPerUnit", 31, 43, { required: true, type: "decimal4", align: "right" }),
      f("quantityToDate", 45, 57, { required: true, type: "decimal4", align: "right" }),
      f("unitOfMeasure", 59, 61, { required: true, type: "text", align: "left" }),
    ],
  },
  PROG: {
    id: "PROG",
    fields: [
      f("recordIdentifier", 1, 4, { required: true, type: "enum", allowed: ["PROG"] }),
      f("activityId", 6, 15, { required: true, type: "identifier", align: "right" }),
      f("actualStart", 17, 23, { type: "date" }),
      f("actualFinish", 25, 31, { type: "date" }),
      f("remainingDuration", 33, 35, { required: true, type: "integer", align: "right" }),
      f("activityCost", 37, 48, { required: true, type: "decimal2", align: "right" }),
      f("costToDate", 50, 61, { required: true, type: "decimal2", align: "right" }),
      f("storedMaterial", 63, 74, { required: true, type: "decimal2", align: "right" }),
      f("earlyStart", 76, 82, { type: "date" }),
      f("earlyFinish", 84, 90, { type: "date" }),
      f("lateStart", 92, 98, { type: "date" }),
      f("lateFinish", 100, 106, { type: "date" }),
      f("floatSign", 108, 108, { type: "enum", allowed: ["+", "-"] }),
      f("totalFloat", 110, 112, { type: "integer", align: "right" }),
    ],
  },
  END: {
    id: "END",
    fields: [f("recordIdentifier", 1, 3, { required: true, type: "enum", allowed: ["END"] })],
  },
};

export const RECORD_ORDER = ["VOLM", "PROJ", "CLDR", "HOLI", "ACTV", "PRED", "UNIT", "PROG", "END"] as const;
