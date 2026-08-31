# SDEF Check

**USACE SDEF checker and validator for QCS/RMS schedule files.**

SDEF Check is a TypeScript parser, validator, library, and CLI for the U.S. Army Corps of Engineers **Standard Data Exchange Format (SDEF)** used to exchange construction schedules with QCS/RMS.

The goal is simple: **catch SDEF problems before QCS/RMS does.**

## At a glance

- **Problem:** SDEF is a rigid fixed-width interchange format where small formatting errors can break downstream QCS/RMS imports or create difficult-to-diagnose interoperability failures.
- **Built:** A deterministic parser and validator that separates core SDEF rules from Primavera/QCS interoperability checks and returns actionable diagnostics.
- **Engineering:** Fixed-position parsing, cross-record validation, date/numeric rules, duplicate/reference checks, regression fixtures, CLI + library APIs, and explicit handling of ambiguous source documentation.
- **Delivery:** Versioned releases with automated testing and CI, designed to work as a standalone CLI, embedded library, desktop preflight layer, or CI check.

> **Status:** early release. The validator is based on ER 1-1-11 Appendix A plus narrowly scoped Primavera/QCS interoperability rules. It has also been cross-checked structurally against MPXJ's current SDEF reader. It is not an official USACE product.

## What it checks

- Fixed-position `VOLM`, `PROJ`, `CLDR`, `HOLI`, `ACTV`, `PRED`, `UNIT`, `PROG`, and `END` records
- Required record groups and record ordering
- The 132-column SDEF envelope and ASCII-only content
- Fixed field positions and required separator columns
- `ddmmmyy` dates and SDEF numeric formats
- Calendar and activity references
- Duplicate activities, calendars, relationships, unit records, and progress records
- Progress-state rules for actual/early/late dates, remaining duration, and float
- Required precedence records for precedence-diagramming schedules
- Workers-per-day requirements, including `0` when no workers are planned
- The four-character QCS project-ID interoperability failure
- Primavera interoperability checks, including the 36-calendar and 10,000-activity ceilings
- P6 Feature of Work length warnings without pretending the conflicting SDEF/P6 documentation is more precise than it is

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

`npm test` compiles the TypeScript and runs the fixture/regression tests with Node's built-in test runner.

## Why this project is deliberately small

SDEF Check is not trying to replace Primavera P6, QCS, RMS, or a scheduling platform. It is a preflight layer: one file in, exact diagnostics out.

That makes it suitable for a CLI, desktop UI, CI check, or embedded validator without changing the core engine.

## Licensing

SDEF Check is open source under **AGPL-3.0-or-later**. See [`LICENSE`](./LICENSE).

Organizations that want to embed, modify, or distribute SDEF Check under proprietary terms can obtain a separate **commercial license from Sithix LLC**. See [`LICENSE-STRATEGY.md`](./LICENSE-STRATEGY.md).

## Sources and scope

The implementation is based primarily on **U.S. Army Corps of Engineers ER 1-1-11, Appendix A (SDEF)**. Primavera/QCS interoperability diagnostics are kept separate where implementation guidance differs from the core format.

One known documentation ambiguity is Feature of Work: Appendix A's fixed columns, current Oracle conversion guidance, current RMS/P6 guidance, and mature third-party SDEF readers do not all agree on the same effective length. SDEF Check preserves the fixed-column field and reports P6-specific length concerns as interoperability warnings instead of silently truncating data.

A larger corpus of genuine contractor/QCS/RMS exports is still desirable. Public SDEF fixtures are unusually scarce, so issues with reproducible sample files are especially valuable.

## Related work

- [Capability](https://github.com/wheresmycoleslaw/capability) — an open-source TypeScript runtime and protocol for giving AI agents a governed ability layer across prepared integrations and software-world fallbacks.

---

Built by **Sithix LLC**.
