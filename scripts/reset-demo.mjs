import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
for (const path of [
  process.env.PANTRYFIT_DEMO_FILE || join(tmpdir(), "pantryfit-demo-v1.json"),
  join(tmpdir(), "pantryfit-demo-session.key"),
]) {
  try {
    await unlink(path);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
console.log(
  "Fictional demo records and sessions reset. Restart the local server.",
);
