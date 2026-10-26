"use client";

import type { Provider } from "@/lib/model";
import {
  verificationFreshness,
  providerVerificationDate,
  providerVerificationStatus,
  verificationFields,
  VERIFICATION_MAX_AGE_DAYS,
} from "@/lib/verification";
import { useApp } from "./context";

export function VerificationSummary({
  provider,
  compact = false,
}: {
  provider: Provider;
  compact?: boolean;
}) {
  const { locale } = useApp();
  const english = locale === "en";
  const status = providerVerificationStatus(provider);
  const checkedAt = providerVerificationDate(provider);
  const labels = english
    ? {
        recent: "Information recently checked",
        outdated: "Recheck needed",
        unconfirmed: "Needs confirmation",
        partial: "Information partially checked",
      }
    : {
        recent: "Información revisada recientemente",
        outdated: "Necesita una nueva revisión",
        unconfirmed: "Necesita confirmación",
        partial: "Información revisada parcialmente",
      };
  const title = provider.demo
    ? english
      ? "Fictional demo service"
      : "Servicio ficticio de demostración"
    : labels[status];
  const date =
    !provider.demo &&
    status !== "unconfirmed" &&
    checkedAt &&
    verificationFreshness(checkedAt) !== "unconfirmed"
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeZone: "America/New_York",
        }).format(new Date(checkedAt))
      : null;

  return (
    <div>
      <strong>{title}</strong>
      {date && (
        <p>
          {english ? "Last checked" : "Última revisión"}: {date}
        </p>
      )}
      {!compact && (
        <>
          <dl className="verification-fields">
            {verificationFields.map((field) => {
              const record = provider.verification?.[field];
              const freshness = verificationFreshness(
                record?.checkedAt ?? null,
              );
              const fieldLabels = english
                ? {
                    hours: "Hours",
                    offerings: "Food offerings",
                    eligibility: "Eligibility",
                    phone: "Phone",
                    coordinates: "Location",
                  }
                : {
                    hours: "Horarios",
                    offerings: "Alimentos",
                    eligibility: "Elegibilidad",
                    phone: "Teléfono",
                    coordinates: "Ubicación",
                  };
              const methods = english
                ? {
                    phone: "Phone confirmation",
                    official_source: "Official source review",
                    in_person: "In-person confirmation",
                  }
                : {
                    phone: "Confirmación telefónica",
                    official_source: "Revisión de fuente oficial",
                    in_person: "Confirmación presencial",
                  };
              const safeSource = record?.sourceUrl?.startsWith("https://")
                ? record.sourceUrl
                : null;
              return (
                <div key={field}>
                  <dt>
                    <strong>{fieldLabels[field]}</strong>
                  </dt>
                  <dd>
                    {provider.demo
                      ? record
                        ? english
                          ? "Demo review recorded"
                          : "Revisión de demostración registrada"
                        : english
                          ? "No demo review recorded"
                          : "Sin revisión de demostración"
                      : freshness === "recent"
                        ? english
                          ? "Confirmed recently"
                          : "Confirmado recientemente"
                        : labels[freshness]}
                    {!provider.demo &&
                      record &&
                      freshness !== "unconfirmed" && (
                        <p className="small-text">
                          {new Intl.DateTimeFormat(locale, {
                            dateStyle: "medium",
                            timeZone: "America/New_York",
                          }).format(new Date(record.checkedAt))}{" "}
                          · {methods[record.method]}
                        </p>
                      )}
                    {safeSource && (
                      <p>
                        <a
                          className="text-link"
                          href={safeSource}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {english ? "Evidence source" : "Fuente de evidencia"}
                        </a>
                      </p>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="small-text">
            {provider.demo
              ? english
                ? "Demo review actions do not verify a real service. Do not visit this illustrative location."
                : "Las revisiones de demostración no verifican un servicio real. No visites esta ubicación ilustrativa."
              : english
                ? `This summary covers hours, food offerings, and eligibility. Information needs another check after ${VERIFICATION_MAX_AGE_DAYS} days. It does not confirm phone or location details or guarantee food availability.`
                : `Este resumen abarca horarios, alimentos y elegibilidad. La información necesita otra revisión después de ${VERIFICATION_MAX_AGE_DAYS} días. No confirma el teléfono ni la ubicación ni garantiza la disponibilidad de alimentos.`}
          </p>
          {!provider.demo && status === "unconfirmed" && (
            <p className="small-text">
              {english
                ? "A source link or provider update alone does not establish independent verification. Confirm details before visiting."
                : "Un enlace a una fuente o una actualización del proveedor por sí solos no establecen una verificación independiente. Confirma los detalles antes de visitar."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
