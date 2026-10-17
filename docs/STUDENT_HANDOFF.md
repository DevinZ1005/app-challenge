# Student technical handoff

Start by running the app and all tests, then read `model.ts`, `matching.ts`, the SQL policies, and `ARCHITECTURE.md`. Be able to follow one household answer from a form field through state, rule evaluation, scoring, and its displayed explanation.

## Required core work

The matcher is a working AI-generated reference. Do not merely rename functions. Students should independently design and implement the core algorithm from the types and pseudocode, comparing behavior against the reference only after writing their own edge-case tests. Substantial redesign options include field-level confidence decay, constrained service/food bundles, minimum pickup durations, normalized scoring policy variants, and multiple transit routes. Choose a coherent scope and justify it rather than adding complexity for its own sake.

Explain these examples on paper and in tests:

- A 0.2 km pantry with a schedule conflict versus a farther compatible program.
- Two individual food offerings that satisfy different constraints but no single option satisfying both.
- A 100% known-fit result with 30% information confidence.
- Unknown dietary support under a strict requirement.
- New York Sunday at a UTC date boundary and the DST transition.
- A rejected cross-organization update sent directly to the API and database.

## Suggested team modules

| Module                  | Student implementation                                      | Required evidence                                               |
| ----------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| Matching                | Rework interval, food constraint, scoring and ranking logic | Commit diff, mathematical derivation, independent tests         |
| Backend security        | Add session refresh/invitations or import transactions      | Threat explanation and real Supabase authorization tests        |
| Data integration        | Implement a reviewed import into normalized tables          | Provenance-preserving transaction and rejected malformed inputs |
| Bilingual accessibility | Review translations, labels, keyboard/focus flow            | Actual bilingual user review and screen-reader test notes       |

Each member should explain a function they personally developed, why its tradeoffs were chosen, and a failing test they made pass. Keep `STUDENT_CONTRIBUTIONS.md` and `AI_USAGE.md` accurate. Use placeholders until activities actually occur. Confirm current official competition rules and entry requirements with the responsible teacher/team before submission; this prototype does not establish eligibility.
