import { Results } from "@/components/results";
import { requireHousehold } from "@/lib/household-auth";
export default async function Page() {
  await requireHousehold();
  return <Results />;
}
