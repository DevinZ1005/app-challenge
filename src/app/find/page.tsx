import { Questionnaire } from "@/components/questionnaire";
import { requireHousehold } from "@/lib/household-auth";
export default async function Page() {
  await requireHousehold();
  return <Questionnaire />;
}
