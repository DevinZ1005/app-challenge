# Student contributions

**Current verified record: no student-authored development has been reported.** The initial prototype, including its matching reference, database, tests, UI, fixture content, and documentation, was produced with AI assistance in this development session. Do not submit it as independently student-written software.

Students must personally implement or substantially modify significant technical modules, understand them, and demonstrate their tests before submission. Complete this table with evidence, not aspirations:

| Student | Date   | File/module and commit | Technical work actually completed | Tests demonstrated  | AI help used          |
| ------- | ------ | ---------------------- | --------------------------------- | ------------------- | --------------------- |
| [Name]  | [Date] | [Commit/file]          | [Actual work; currently unfilled] | [Executed evidence] | [Accurate disclosure] |

Priority assignments:

1. Reimplement or substantially redesign `src/lib/matching.ts` from its contracts and independent pseudocode. Justify weights, hard constraints, joint food compatibility, stale-data rules, and deterministic ties. Write independent counterexample tests.
2. Build and explain interval handling, exceptional closures, timezones/DST, and a meaningful minimum pickup duration. Demonstrate why touching endpoints do not overlap.
3. Implement and test at least one substantial additional full-stack module: real import-to-database transactions, verified routing adapters, field-level verification freshness, or secure Supabase session refresh/onboarding.
4. Test RLS against a real Supabase project with unrelated organizations and document actual results. Explain why frontend roles alone cannot authorize edits.
5. Verify a small local dataset, perform consent-based bilingual usability/accessibility tests, and document real outcomes. This work complements, not substitutes for, substantial programming.

See `docs/STUDENT_HANDOFF.md` for exercises and required evidence. Record actual student commits and experiences. Do not claim that running this prototype or changing colors alone constitutes substantial technical authorship.
