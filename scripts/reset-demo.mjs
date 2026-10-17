import { unlink } from "node:fs/promises";
for (const path of [
  "/tmp/pantryfit-demo-v1.json",
  "/tmp/pantryfit-demo-session.key",
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
