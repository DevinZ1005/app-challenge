import type { Metadata } from "next";
import { ProviderApplicationForm } from "@/components/provider-application";

export const metadata: Metadata = { title: "Apply to join | PantryFit" };
export default function Page() {
  return <ProviderApplicationForm />;
}
