"use client";
import Link from "next/link";
import { useApp } from "@/components/context";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useApp();
  return (
    <section className="container page-space" role="alert">
      <h1>{locale === "en" ? "Something went wrong" : "Algo salió mal"}</h1>
      <p>
        {locale === "en"
          ? "Try again. Your preferences stay here while this page recovers."
          : "Inténtalo de nuevo. Tus preferencias se conservan mientras se recupera esta página."}
      </p>
      <div className="inline-fields">
        <button className="button" onClick={reset}>
          {locale === "en" ? "Try again" : "Intentar otra vez"}
        </button>
        <Link href="/" className="button secondary">
          {locale === "en" ? "Go home" : "Ir al inicio"}
        </Link>
      </div>
    </section>
  );
}
