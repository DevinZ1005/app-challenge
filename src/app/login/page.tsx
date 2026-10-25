import { WelcomeLogin } from "@/components/welcome-login";
import { emailLoginEnabled, householdSignedIn } from "@/lib/household-auth";
import { isDemo } from "@/lib/server";
import { redirect } from "next/navigation";
export default async function Page() {
  if (await householdSignedIn()) redirect("/find");
  return <WelcomeLogin demo={isDemo} enabled={emailLoginEnabled()} />;
}
