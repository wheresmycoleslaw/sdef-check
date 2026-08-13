# Validation basis

SDEF Check separates **core SDEF format rules** from **Primavera P6 / QCS interoperability rules**. The distinction matters because some current workflow constraints are not obvious from the fixed-width record layouts alone.

## Primary USACE sources

- **ER 1-1-11, Project Schedules, Appendix A** — core SDEF record layout, ordering, field widths, types, and required records.
  - https://www.publications.usace.army.mil/USACE-Publications/Engineer-Regulations/
- **RMS/QCS: “How do I resolve the 'not a valid integer' error when performing an SDEF import?”** — documents the requirement that the Primavera Project ID used for SDEF be exactly four characters because shorter values can shift fixed-width fields and cause QCS integer errors.
  - https://rms.usace.army.mil/datafiles/helpvideos/qcsabout/Advanced/Content/Topics/FAQ_QCS_2/How%20do%20I%20resolve%20the%20%27not%20a%20valid%20integer%27%20error%20when%20performing%20an%20SDEF%20import.htm
- **RMS/QCS: “How do I setup the Activity Code Structure in Primavera?”** — documents current P6/SDEF interoperability behavior including:
  - WRKP 3, RESP 4, AREA 4, MODF 6, BIDI 6, PHAS 2, CATW 1, FOW 20
  - activity descriptions exported to 30 characters
  - activity IDs limited to 10 characters, with duplicate-ID risk after truncation
  - maximum 10,000 activities
  - calendar codes limited to one character and 36 calendars (`A-Z`, `0-9`)
  - durations above 999 days converting to zero
  - P6 milestones converting to zero-duration SDEF activities
  - https://rms.usace.army.mil/datafiles/helpvideos/qcsabout/Advanced/Content/Topics/FAQ_QCS_2/How%20do%20I%20setup%20the%20%20Activity%20Code%20Structure%20in%20Primavera.htm
- **RMS/QCS: “How do I fix crashes when importing from Primavera (Regional Settings)?”** — documents non-English Windows regional settings as a cause of SDEF import crashes and recommends English (United States) formatting.
  - https://rms.usace.army.mil/datafiles/helpvideos/qcsabout/Advanced/Content/Topics/FAQ_QCS_2/How%20do%20I%20fix%20crashes%20when%20importing%20from%20Primavera%20%28Regional%20Settings%29.htm

## Independent structural cross-check

The record layouts and parser behavior have also been compared against the current MPXJ SDEF implementation. MPXJ is not treated as the authority over USACE documentation; it is used as a mature independent implementation for detecting obvious interpretation mistakes.

Current cross-check release at the time of this document: **MPXJ 16.7.0** (2026-08-08).

- https://github.com/joniles/mpxj/tree/master/src/main/java/org/mpxj/sdef

## Real-world-derived fixture

`test/fixtures/real-world-derived.sdef` is a **sanitized derivative**, not a contractor-submitted SDEF and not evidence of QCS acceptance.

It was built from activity, duration, date, milestone, and relationship patterns in a public Primavera XER example contained in the MIT-licensed `pschimmel/NAS` repository. Project identity, contractor identity, contract number, costs, and other project-specific metadata were removed or replaced. The fixture exists to exercise realistic P6 schedule shapes, especially zero-duration milestones and closeout logic.

Source XER:

- `Files/Examples/Initial Schedule Bldgs 8108 and 8228 Smith Barracks Baumholder.xer`
- https://github.com/pschimmel/NAS

The source XER exposed an important validator false positive: current USACE guidance says P6 milestones are converted to zero-duration SDEF activities, so an unstarted zero-duration activity can legitimately have Remaining Duration `0` without an Actual Finish. That case is now covered by regression tests.

## Remaining evidence gap

SDEF Check still needs at least one **genuine SDEF file known to have successfully imported into QCS/RMS** and, ideally, several genuine failed imports with their exact QCS/RMS error messages. Until those are available, the project should not claim certification, official validation, or perfect QCS behavioral equivalence.

Public contributions of sanitized fixtures are tracked in GitHub issues. Files should only be contributed when the submitter has the right to share them.
