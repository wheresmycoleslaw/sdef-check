# SDEF Check

**USACE SDEF checker and validator for QCS/RMS schedule files.**

SDEF Check is a small TypeScript parser, validator, and CLI for the U.S. Army Corps of Engineers **Standard Data Exchange Format (SDEF)** used to exchange construction schedules with QCS/RMS.

The goal is simple: **catch SDEF problems before QCS/RMS does.**

> **Status:** early prototype. The validator is based on ER 1-1-11 Appendix A plus narrowly scoped Primavera/QCS interoperability rules. It is not an official USACE product and still needs validation against a larger corpus of real-world exports.

## What it checks

- Fixed-position `VOLM`, `PROJ`, `CLDR`, `HOLI`, `ACTV`, `PRED`, `UNIT`, `PROG`, and `END` records
- Required record groups and record ordering
- The 132-column SDEF envelope and ASCII-only content
- Fixed field positions and required separator columns
- `ddmmmyy` dates and SDEF numeric formats
- Calendar and activity references
- Duplicate activities, calendars, relationships, unit records, and progress records
- Progress-state rules for actual/early/late dates, remaining duration, and float
- The four-character QCS project-ID interoperability failure
- The practical 10,000-activity Primavera SDEF conversion ceiling

## CLI

```bash
npm install
npm run build
node dist/cli.js path/to/project.sdef
```

JSON output:

```bash
node dist/cli.js path/to/project.sdef --json
```

Disable the extra Primavera/QCS interoperability checks and validate only the core SDEF rules:

```bash
node dist/cli.js path/to/project.sdef --no-p6-interop
```

Example:

```text
FAIL bad-project-id.sdef — 1 error(s), 0 warning(s)
2 activities · 1 relationships · 1 calendars · 9 records
ERROR   PROJECT_ID_LENGTH (line 2, projectIdentifier): Project Identifier must occupy exactly four characters for QCS interoperability; found 3.
        fix: Pad or change the project ID to four characters before generating/importing SDEF; a short value shifts later fixed-width fields in broken exports.
```

## Library API

```ts
import { validateSdef } from "sdef-check";

const result = validateSdef(fileText);

if (!result.valid) {
  console.log(result.diagnostics);
}
```

The lower-level parser is also exported:

```ts
import { parseSdef } from "sdef-check";

const document = parseSdef(fileText);
```

## Development

Requires Node.js 20+.

```bash
npm install
npm test
```

`npm test` compiles the TypeScript and runs the fixture tests with Node's built-in test runner.

## Why this project is deliberately small

SDEF Check is not trying to replace Primavera P6, QCS, RMS, or a scheduling platform. It is a preflight layer: one file in, exact diagnostics out.

That makes it suitable for a CLI today and, later, a desktop UI, CI check, or embedded validator without changing the core engine.

## Licensing

No open-source license has been selected yet. Until a license is added, normal copyright restrictions apply even if the repository is publicly visible. See [`LICENSE-STRATEGY.md`](./LICENSE-STRATEGY.md) for the current dual-licensing considerations before public release.

## Sources and scope

The implementation is based primarily on **U.S. Army Corps of Engineers ER 1-1-11, Appendix A (SDEF)**. Some interoperability diagnostics are intentionally treated as implementation-specific checks rather than core format requirements.

Real-world QCS/RMS fixture testing is the next major validation step before this should be treated as authoritative.
