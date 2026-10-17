import { writeFile } from "node:fs/promises";
import { demoProviders } from "../src/lib/data";
await writeFile(
  "docs/demo-data.json",
  JSON.stringify(demoProviders, null, 2) + "\n",
);
