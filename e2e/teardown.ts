import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname } from "node:path";

export default async function teardown() {
  const file = process.env.PANTRYFIT_E2E_FILE;
  if (
    !file ||
    dirname(file) !== tmpdir() ||
    !/^pantryfit-e2e-[\da-f-]+\.json$/.test(basename(file))
  )
    throw Error("Refusing to clean an unowned test data path");
  try {
    await unlink(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
