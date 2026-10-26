import { ProviderDetail } from "@/components/results";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ProviderDetail id={(await params).id} />;
}
