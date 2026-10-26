"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "./context";

export function AccountAccess({ email }: { email: string }) {
  const { t } = useApp();
  const router = useRouter();
  const [error, setError] = useState("");
  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw Error();
      router.push("/provider/login");
    } catch {
      setError(t.error);
    }
  }
  return (
    <section className="container page-space">
      <h1>{t.unaffiliatedTitle}</h1>
      <p>
        {t.signedIn} {email}
      </p>
      <p>{t.unaffiliatedText}</p>
      <button className="button secondary" onClick={logout}>
        {t.logout}
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
