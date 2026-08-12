export type Severity = "error" | "warning" | "info";

export interface Diagnostic {
  severity: Severity;
  code: string;
  message: string;
  line?: number;
  record?: string;
  field?: string;
  columns?: [number, number];
  suggestion?: string;
}

export interface ParsedRecord {
  line: number;
  kind: string;
  raw: string;
  fields: Record<string, string>;
}

export interface SdefDocument {
  records: ParsedRecord[];
  byKind: Map<string, ParsedRecord[]>;
}

export interface ValidationOptions {
  /** Reject any record longer than the 132-character SDEF envelope. Default true. */
  enforce132Columns?: boolean;
  /** Apply practical Primavera/QCS interoperability checks in addition to Appendix A. Default true. */
  p6Interop?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: number;
  warnings: number;
  diagnostics: Diagnostic[];
  document: SdefDocument;
  summary: {
    lines: number;
    activities: number;
    calendars: number;
    relationships: number;
    unitCosts: number;
    progressRecords: number;
  };
}
