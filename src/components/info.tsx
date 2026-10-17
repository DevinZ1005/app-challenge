"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ShieldCheck, CircleHelp, Code2 } from "lucide-react";
import { useApp } from "./context";
export function InfoPage({
  page,
}: {
  page: "how-it-works" | "for-providers" | "privacy" | "about";
}) {
  const { t, locale } = useApp();
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");
  return (
    <section className="container info-page">
      <span className="eyebrow">PANTRYFIT · {t.tagline}</span>
      <h1>
        {page === "how-it-works"
          ? t.howTitle
          : page === "for-providers"
            ? t.providerTitle
            : page === "privacy"
              ? t.privacyTitle
              : t.aboutTitle}
      </h1>
      <p className="info-lead">
        {page === "how-it-works"
          ? t.howIntro
          : page === "for-providers"
            ? t.providerIntro
            : page === "privacy"
              ? t.privacyText
              : t.aboutText}
      </p>
      {page === "how-it-works" ? (
        <>
          <div className="info-steps">
            {[t.step1, t.step2, t.step3].map((s, i) => (
              <div key={s}>
                <span>{i + 1}</span>
                <h2>{s}</h2>
              </div>
            ))}
          </div>
          <div className="info-panel">
            <h2>{t.scoreTitle}</h2>
            <p>{t.scoreText}</p>
            <div className="weight-bars">
              {[
                [t.schedule, 30],
                [t.maxTime, 25],
                [t.storageTitle, 20],
                [t.food, 15],
                [t.dietTitle, 10],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <i style={{ width: `${Number(value) * 2}%` }} />
                  <b>{value}%</b>
                </div>
              ))}
            </div>
            <p>{t.constraintText}</p>
          </div>
          <div className="notice">
            <CircleHelp />
            {t.warning}
          </div>
          <Link href="/find" className="button">
            {t.cta}
            <ArrowRight size={18} />
          </Link>
        </>
      ) : page === "for-providers" ? (
        <>
          <div className="info-panel">
            <ShieldCheck size={30} />
            <h2>{t.providers}</h2>
            <p>{t.accessText}</p>
            <Link href="/provider/login" className="button">
              {t.providerCTA}
              <ArrowRight size={18} />
            </Link>
          </div>
          <p>{t.updateLabel}</p>
        </>
      ) : page === "privacy" ? (
        <div className="info-panel">
          <ShieldCheck size={30} />
          <p>{t.privacyMore}</p>
        </div>
      ) : (
        <>
          <div className="info-panel">
            <Code2 size={30} />
            <h2>{t.about}</h2>
            <p>{t.disclosure}</p>
          </div>
          <div className="detail-block" id="feedback">
            <h2>{t.feedback}</h2>
            <p>{t.feedbackText}</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const r = await fetch("/api/feedback", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: feedback }),
                  });
                  setMessage(
                    r.ok
                      ? locale === "en"
                        ? "Thank you. Your report was saved for review."
                        : "Gracias. Tu informe se guardó para revisión."
                      : t.error,
                  );
                  if (r.ok) setFeedback("");
                } catch {
                  setMessage(t.error);
                }
              }}
            >
              <label>
                {t.feedback}
                <textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </label>
              <button className="button secondary">
                {locale === "en" ? "Send report" : "Enviar informe"}
              </button>
              {message && <p role="status">{message}</p>}
            </form>
          </div>
          <Link href="/how-it-works" className="text-link">
            {t.how}
            <ArrowRight size={18} />
          </Link>
        </>
      )}
    </section>
  );
}
