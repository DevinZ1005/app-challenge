# Data research and verification

Research date: 2026-10-17. Sources were identified through web research; **no individual Bronx service was independently verified or imported**. `src/lib/data.ts`, `docs/demo-data.json`, and `supabase/seed.sql` contain fictional fixtures only, kept separate from real imports.

## Reputable starting points

- [NYC HRA Community Food Connection](https://www.nyc.gov/site/hra/help/food-assistance.page): links to NYC food pantry/community kitchen resources. Directory inclusion is a provenance source, not verification of today's schedule or selection.
- [NYC Food Help service finder](https://finder.nyc.gov/foodhelp/locations): official service discovery. Review the original listing and confirm the appropriate program, location, and fields.
- [NYC311 Food Pantries and Soup Kitchens](https://portal.311.nyc.gov/article/?kanumber=KA-02740): advises calling before a visit to confirm hours.
- [ACCESS NYC Community Food Connection](https://access.nyc.gov/programs/emergency-food-assistance/): public guidance and links for finding food assistance.
- [NYC Open Data Community Food Connection Quarterly Report](https://data.cityofnewyork.us/Social-Services/Community-Food-Connection-Quarterly-Report-/mpqk-skis): aggregate service counts, not a verified provider-level schedule directory. Do not import counts as service locations or infer local barriers from them.
- [NYC Open Data Directory of SNAP Centers](https://data.cityofnewyork.us/Social-Services/Directory-of-SNAP-Centers/tc6u-8rnp): benefit-office listings, not automatically food pickups. Keep service types distinct.

The app links to the official NYC food finder so prototype users can access real services. It does not scrape or republish unverified current hours.

## Verification checklist, per program/location

- [ ] Record original official/public URL, organization, collected UTC timestamp, attribution and reuse terms.
- [ ] Confirm public organization name, actual service location, ZIP code, and type of assistance.
- [ ] Verify coordinates against the confirmed service entrance; do not geocode private household locations.
- [ ] Confirm public phone and whether it is appropriate for food assistance inquiries.
- [ ] Confirm weekly days, start/end times, New York timezone, appointment/registration process, pickup limits, and holiday closures.
- [ ] Ask about public eligibility restrictions without collecting household personal information.
- [ ] Ask which food options are documented, which require equipment or refrigeration, and which attributes are genuinely verified.
- [ ] Distinguish recurring availability from variable stock. Never promise a specific food will be available.
- [ ] Confirm dietary/religious claims with the provider. Do not infer certification, allergy safety, or cross-contact protections.
- [ ] Confirm accessibility information only when documented.
- [ ] Record verification method/date, staff verifier, fields confirmed, evidence/notes, and next review date.
- [ ] Have a bilingual reviewer check English/Spanish provider descriptions and mark translation provenance in notes.
- [ ] Keep missing facts explicitly unknown; do not fill gaps from similar providers.
- [ ] Request organization consent/association evidence before granting a provider account.

Suggested contact script: “We are developing a prototype directory. May we confirm your public pickup schedule and whether the listed information is appropriate to publish? We will clearly identify uncertain and changeable details.” This is a suggested script, not a record of an actual call.

## Import contract

`npm run import:data -- input.json output.json` validates the `Provider` shape with Zod, flags malformed data, requires provenance for real records, and rejects mixed real/fictional files. It neither invents missing facts nor grants verification. The documented JSON contract is reusable by region and includes bilingual text and local schedules. Use `docs/demo-data.json` as the fictional example and the TypeScript interfaces as the source of truth.

After validation, a trusted administrator enters reviewed identity/provenance via the admin form and uses provider proposals plus review for hours/offerings. Bulk automatic publication is intentionally not implemented. Keep raw source files outside the public directory and exclude private staff correspondence from imports.
