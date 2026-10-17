/** Validate a JSON dataset without publishing or upgrading verification claims. */
import { readFile, writeFile } from "node:fs/promises";
import { providerImportSchema } from "../src/lib/listings";
const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: npm run import:data -- input.json validated.json");
  process.exit(1);
}
const values: unknown = JSON.parse(await readFile(input, "utf8"));
if (!Array.isArray(values)) throw Error("Expected a JSON array");
const providers = values.map((v, i) => {
  const parsed = providerImportSchema.safeParse(v);
  if (!parsed.success) throw Error(`Row ${i + 1}: ${parsed.error.message}`);
  return parsed.data;
});
if (new Set(providers.map((p) => p.id)).size !== providers.length)
  throw Error("Duplicate program IDs");
if (providers.some((p) => p.demo) && providers.some((p) => !p.demo))
  throw Error("Keep real and demo datasets in separate files");
await writeFile(output, JSON.stringify(providers, null, 2) + "\n");
console.log(
  `Validated ${providers.length} ${providers[0]?.demo ? "fictional" : "source-attributed"} records. No records were published or independently verified.`,
);
