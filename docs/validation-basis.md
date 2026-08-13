# Validation basis

SDEF Check separates **ER 1-1-11 Appendix A rules** from **Primavera P6 / QCS interoperability rules**. The distinction is intentional because the current P6 conversion guidance and Appendix A are not identical in every edge case.

## Primary USACE sources

- **ER 1-1-11, Project Schedules, Appendix A** — authoritative core SDEF record layout, ordering, field widths, justification, date abbreviations, progress-state rules, and float rules.
  - https://www.publications.usace.army.mil/Portals/76/Publications/EngineerRegulations/ER_1-1-11.pdf
- **RMS/QCS: “How do I resolve the 'not a valid integer' error when performing an SDEF import?”** — documents the Primavera/QCS requirement for an exactly four-character Project ID because shorter values can shift fixed-width fields.
  - https://rms.usace.army.mil/datafiles/helpvideos/qcsabout/Advanced/Content/Topics/FAQ_QCS_2/How%20do%20I%20resolve%20the%20%27not%20a%20valid%20integer%27%20error%20when%20performing%20an%20SDEF%20import.htm
- **RMS/QCS: “How do I setup the Activity Code Structure in Primavera?”** — documents P6/SDEF interoperability behavior including WRKP, 20-character FOW values, 10-character activity IDs, the 10,000-activity ceiling, 36 one-character calendars (`A-Z`, `0-9`), the 999-day duration limit, and conversion of milestones to zero-duration activities.
  - https://rms.usace.army.mil/datafiles/helpvideos/qcsabout/Advanced/Content/Topics/FAQ_QCS_2/How%20do%20I%20setup%20the%20%20Activity%20Code%20Structure%20in%20Primavera.htm

## Core mode versus P6/QCS mode

`validateSdef()` enables P6/QCS interoperability checks by default. Set `p6Interop: false`, or use CLI `--no-p6-interop`, to apply only core Appendix A behavior where the two differ.

Three differences are explicitly modeled:

1. **Project Identifier** — Appendix A describes a maximum four-character identifier. RMS/QCS guidance requires exactly four characters for Primavera interoperability. Exact-four is therefore enforced only in P6/QCS mode.
2. **Workers Per Day** — Appendix A says the value is used when required by project scheduling specifications and says activities without workers use `0`. Current P6/QCS coding guidance uses WRKP. SDEF Check requires it in P6/QCS mode but does not invent a universal core requirement.
3. **Zero-duration milestones** — P6 guidance says milestones convert to zero-duration SDEF activities, while Appendix A also states that Remaining Duration `0` requires an Actual Finish. SDEF Check permits the unstarted zero-duration milestone edge case in P6/QCS mode and enforces the literal Appendix A rule in core-only mode.

## MPXJ cross-check

MPXJ is used only as an independent implementation cross-check; USACE documentation remains authoritative. The current comparison uses **MPXJ 16.7.0**.

A GitHub Actions probe converted a pinned public modern Primavera XER through MPXJ and then ran the generated SDEF through SDEF Check. MPXJ successfully read the `Pump Station Upgrade` sample (32 tasks, one calendar) and produced a 79-record SDEF with 24 ACTV, 27 PRED, and 24 PROG records.

The probe confirmed several SDEF Check diagnostics rather than invalidating them. MPXJ's generated file differed from Appendix A by emitting uppercase month codes such as `03AUG26`, a two-character calendar value, left-justified activity/predecessor IDs, and `+` signs on some zero-float activities. Appendix A explicitly defines title-case month abbreviations, one-character calendar codes separated by blank columns, right-justified numeric ID fields, and a blank Float Sign when float is zero.

A separate older public XER from the `pschimmel/NAS` corpus could not reach SDEF conversion because MPXJ 16.7.0 threw a `ClassCastException` while reading the project-level `def_cost_per_qty` field. That is an MPXJ/XER compatibility finding, not an SDEF Check failure.

## Real-world-derived fixture

`test/fixtures/real-world-derived.sdef` is a **sanitized derivative**, not a contractor-submitted SDEF and not evidence of QCS acceptance. It was built from activity, duration, date, milestone, and relationship patterns in a public Primavera XER example in the MIT-licensed `pschimmel/NAS` repository. Project identity, contractor identity, contract number, costs, and other project-specific metadata were replaced or removed.

## Remaining evidence gap

SDEF Check still needs at least one **genuine SDEF known to have successfully imported into QCS/RMS**, and ideally several genuine failed imports with their exact QCS/RMS errors. Until then, the project should not claim certification, official validation, or perfect QCS behavioral equivalence.
