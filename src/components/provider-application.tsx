"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useApp } from "./context";
import { providerApplicationRequestSchema } from "@/lib/provider-application";

export function ProviderApplicationForm() {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState<string[]>([]);
  const fields = [
    {
      name: "organizationName",
      label: t.applicationOrganization,
      min: 2,
      max: 160,
      autoComplete: "organization",
    },
    {
      name: "organizationAddress",
      label: t.applicationAddress,
      min: 5,
      max: 400,
      autoComplete: "street-address",
      multiline: true,
    },
    {
      name: "contactName",
      label: t.applicationContact,
      min: 2,
      max: 120,
      autoComplete: "name",
    },
    {
      name: "contactEmail",
      label: t.applicationEmail,
      min: 3,
      max: 254,
      type: "email",
      autoComplete: "email",
    },
    {
      name: "contactPhone",
      label: t.applicationPhone,
      min: 7,
      max: 30,
      type: "tel",
      autoComplete: "tel",
      optional: true,
    },
    {
      name: "organizationWebsite",
      label: t.applicationWebsite,
      max: 500,
      type: "url",
      autoComplete: "url",
      optional: true,
    },
    {
      name: "description",
      label: t.applicationDescription,
      min: 20,
      max: 1000,
      multiline: true,
    },
  ];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const parsed = providerApplicationRequestSchema.safeParse(values);
    setError("");
    setInvalid([]);
    if (!parsed.success) {
      const names = parsed.error.issues.map((issue) => String(issue.path[0]));
      setInvalid(names);
      setError(t.applicationInvalid);
      const first = form.elements.namedItem(names[0]);
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/provider-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.status === 202) {
        form.reset();
        setSent(true);
      } else {
        setError(
          response.status === 429
            ? t.applicationLimited
            : response.status === 400 || response.status === 413
              ? t.applicationInvalid
              : t.applicationUnavailable,
        );
      }
    } catch {
      setError(t.applicationUnavailable);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="container info-page">
      <span className="eyebrow">PANTRYFIT</span>
      <h1>{t.applicationTitle}</h1>
      <p className="info-lead">{t.applicationIntro}</p>
      {sent ? (
        <div className="info-panel" role="status" aria-live="polite">
          <h2>{t.applicationSuccessTitle}</h2>
          <p>{t.applicationSuccess}</p>
        </div>
      ) : (
        <form
          className="info-panel"
          method="post"
          action="/api/provider-applications"
          onSubmit={submit}
          aria-busy={busy}
        >
          {fields.map((field) => {
            const id = `application-${field.name}`;
            const hasError = invalid.includes(field.name);
            const props = {
              id,
              name: field.name,
              required: !field.optional,
              minLength: field.min,
              maxLength: field.max,
              autoComplete: field.autoComplete,
              "aria-invalid": hasError,
              "aria-describedby":
                [
                  hasError ? `${id}-error` : "",
                  field.name === "description"
                    ? "application-description-hint"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ") || undefined,
            };
            return (
              <div key={field.name}>
                <label htmlFor={id}>
                  {field.label}
                  {field.multiline ? (
                    <textarea
                      {...props}
                      rows={field.name === "description" ? 4 : 2}
                    />
                  ) : (
                    <input {...props} type={field.type || "text"} />
                  )}
                </label>
                {field.name === "description" && (
                  <p className="small-text" id="application-description-hint">
                    {t.applicationDescriptionHint}
                  </p>
                )}
                {hasError && (
                  <p className="error-message" id={`${id}-error`}>
                    {t.applicationInvalidField}
                  </p>
                )}
              </div>
            );
          })}
          <div hidden aria-hidden="true">
            <label>
              Leave this empty
              <input name="faxNumber" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <p className="small-text">{t.applicationPrivacy}</p>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? t.applicationSubmitting : t.applicationSubmit}
          </button>
        </form>
      )}
      <p>
        <Link className="text-link" href="/provider/login">
          {t.providerCTA}
        </Link>
      </p>
    </section>
  );
}
