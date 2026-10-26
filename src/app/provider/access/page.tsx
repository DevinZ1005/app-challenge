import { redirect } from "next/navigation";
import { AccountAccess } from "@/components/account-access";
import { identity, HttpError } from "@/lib/server";

export default async function Page() {
  const account = await identity().catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 401)
      redirect("/provider/login");
    throw error;
  });
  if (account.role === "admin") redirect("/admin");
  if (account.role === "provider") redirect("/provider/dashboard");
  return <AccountAccess email={account.email} />;
}
