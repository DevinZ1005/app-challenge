# Three-minute functioning demo outline

These are suggested actions, not evidence that a video has been recorded.

| Time      | Screen/action                                                                   | Suggested narration                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:25 | Home; show demo banner                                                          | “PantryFit explores a practical question: which food assistance could a household use, not just which is nearby? We start with 10468 in the Bronx. These are fictional development records.”              |
| 0:25–0:55 | Questionnaire; choose Tuesday afternoon, no cooking equipment, no refrigeration | “No account or private household address is required. We collect only practical preferences. Switching to Spanish keeps our answers.”                                                                     |
| 0:55–1:25 | Results; expand Garden Table explanation                                        | “Schedule, storage and cooking contribute 65 known compatible weight points. Travel's 25 points are unknown, so known fit is 100% but confidence is 72%. This is a possible match, not a guarantee.”      |
| 1:25–1:45 | Show Community Kitchen conflict and provider details                            | “This service's recorded schedule does not overlap. A high food score cannot override a hard schedule conflict. Unverified data and fictional locations are explicitly labeled.”                          |
| 1:45–2:15 | Sign in as demo provider; submit hours; switch admin; approve                   | “Staff propose changes only to their own organization. Admin review publishes the proposal and creates an audit record. Approval is different from independent verification.”                             |
| 2:15–2:40 | Show actual student implementation and executed tests                           | “[Student explains the code they personally implemented, an actual bug, and the independent test they wrote. Replace with real work before recording.]”                                                   |
| 2:40–3:00 | Architecture and disclosure                                                     | “The prototype uses Next.js, TypeScript, Supabase policies and an explainable matcher. Initial code was AI-assisted; [accurately name student work]. Next steps include verified local data and routing.” |

## Factual submission draft

**What does the app do?** PantryFit is a bilingual prototype that compares food-assistance service information with a household’s schedule, transport limits, cooking equipment, storage access, and food preferences. It explains known conflicts and missing information, and supports reviewed provider updates.

**Why did the team create it?** [Students describe their actual motivation.] The product tests the hypothesis that practical constraints can make a nearby service unusable. We have not established neighborhood-specific prevalence or impact.

**Who benefits?** The intended audience is people seeking food assistance, initially around ZIP code 10468, and organizations maintaining public service information. Actual users served: [enter verified number or state not yet measured].

**Programming challenges encountered?** [Describe a challenge students personally encountered and their own code changes.] The reference design offers challenges in interval overlaps, three-valued reasoning, joint food constraints, deterministic scoring, and database authorization. Do not present these as student experiences until they occur.

**How were challenges solved?** [Actual student algorithm, debugging process, commit references, and test evidence.]

**What did the team learn?** [Students’ own reflection, not an AI-invented narrative.]

**Future improvements?** Verified small local dataset, accessible bilingual testing, reliable multimodal routing, stronger production session management, and field-specific freshness. No claims of uniqueness against all existing products are made.

**AI use?** The initial reference prototype and documentation were generated with AI assistance. [Add accurate summary of subsequent student-authored modules and AI use.] See `AI_USAGE.md` and `STUDENT_CONTRIBUTIONS.md`.
