import { ProviderDetail } from "@/components/results";
import { requireHousehold } from "@/lib/household-auth";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireHousehold();
  return <ProviderDetail id={(await params).id} />;
}
