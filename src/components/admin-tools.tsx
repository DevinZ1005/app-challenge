"use client";
import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { useApp } from "./context";
import { listingSchema, verificationSchema } from "@/lib/listings";
export function AdminTools({
  programId,
  onSaved,
}: {
  programId: string;
  onSaved: () => void;
}) {
  const { t, locale, demo } = useApp();
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [method, setMethod] = useState("official_source");
  const [notes, setNotes] = useState("");
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    const v = listingSchema.safeParse({
      name: { en: d.get("nameEn"), es: d.get("nameEs") },
      description: { en: d.get("descriptionEn"), es: d.get("descriptionEs") },
      address: { en: d.get("addressEn"), es: d.get("addressEs") },
      zip: d.get("zip"),
      lat: Number(d.get("lat")),
      lng: Number(d.get("lng")),
      type: d.get("type"),
      sourceName: { en: d.get("sourceEn"), es: d.get("sourceEs") },
      sourceUrl: d.get("sourceUrl"),
      collectedAt: new Date().toISOString(),
    });
    if (!v.success) {
      setMessage(t.saveError);
      return;
    }
    try {
      const r = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v.data),
      });
      setMessage(r.ok ? t.saved : t.saveError);
      if (r.ok) {
        form.reset();
        onSaved();
      }
    } catch {
      setMessage(t.saveError);
    }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const v = verificationSchema.safeParse({
      programId,
      method,
      fields,
      notes,
    });
    if (!v.success) {
      setMessage(t.saveError);
      return;
    }
    try {
      const r = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v.data),
      });
      setMessage(
        r.ok
          ? locale === "en"
            ? "Review action recorded."
            : "Acción de revisión registrada."
          : t.saveError,
      );
      if (r.ok) {
        setNotes("");
        onSaved();
      }
    } catch {
      setMessage(t.saveError);
    }
  }
  return (
    <>
      <div className="detail-block">
        <details>
          <summary>
            <Plus size={15} />{" "}
            {locale === "en" ? "Add a listing" : "Añadir un registro"}
          </summary>
          <form onSubmit={add}>
            {demo && <p className="small-text">{t.demoNotice}</p>}
            {[
              ["name", locale === "en" ? "Name" : "Nombre"],
              ["description", t.description],
              [
                "address",
                locale === "en" ? "Public address" : "Dirección pública",
              ],
              ["source", t.source],
            ].map(([key, label]) => (
              <div className="inline-fields" key={key}>
                <label>
                  {label} · English
                  <input name={key + "En"} required maxLength={400} />
                </label>
                <label>
                  {label} · Español
                  <input name={key + "Es"} required maxLength={400} />
                </label>
              </div>
            ))}
            <div className="inline-fields">
              <label>
                {t.zip}
                <input
                  name="zip"
                  defaultValue="10468"
                  required
                  pattern="[0-9]{5}"
                />
              </label>
              <label>
                {t.type}
                <select name="type">
                  <option value="pantry">{t.pantry}</option>
                  <option value="meals">{t.meals}</option>
                  <option value="community">{t.communityType}</option>
                </select>
              </label>
            </div>
            <div className="inline-fields">
              <label>
                {locale === "en" ? "Latitude" : "Latitud"}
                <input
                  name="lat"
                  type="number"
                  step="any"
                  required
                  min={-90}
                  max={90}
                />
              </label>
              <label>
                {locale === "en" ? "Longitude" : "Longitud"}
                <input
                  name="lng"
                  type="number"
                  step="any"
                  required
                  min={-180}
                  max={180}
                />
              </label>
            </div>
            <label>
              {t.source} · URL
              <input name="sourceUrl" type="url" placeholder="https://" />
            </label>
            <button className="button small">
              {locale === "en" ? "Create listing" : "Crear registro"}
            </button>
          </form>
        </details>
      </div>
      <div className="detail-block">
        <h2>
          <ShieldCheck size={20} />{" "}
          {locale === "en"
            ? "Data quality review"
            : "Calidad de la información"}
        </h2>
        <form onSubmit={verify}>
          <p>
            {locale === "en"
              ? "Only record evidence you personally reviewed. Demo records remain fictional."
              : "Registra solo evidencia que hayas revisado personalmente. Los datos de ejemplo siguen siendo ficticios."}
          </p>
          <label>
            {locale === "en" ? "Verification method" : "Método de verificación"}
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="official_source">
                {locale === "en"
                  ? "Official source review"
                  : "Revisión de fuente oficial"}
              </option>
              <option value="phone">
                {locale === "en"
                  ? "Phone confirmation"
                  : "Confirmación telefónica"}
              </option>
              <option value="in_person">
                {locale === "en"
                  ? "In-person confirmation"
                  : "Confirmación presencial"}
              </option>
              <option value="flag_outdated">
                {locale === "en"
                  ? "Flag outdated information"
                  : "Marcar información desactualizada"}
              </option>
            </select>
          </label>
          {method !== "flag_outdated" && (
            <fieldset>
              <legend>
                {locale === "en"
                  ? "Fields actually confirmed"
                  : "Datos realmente confirmados"}
              </legend>
              {[
                ["hours", t.hours],
                ["offerings", t.offerings],
                ["eligibility", t.eligibility],
                [
                  "coordinates",
                  locale === "en" ? "Coordinates" : "Coordenadas",
                ],
                ["phone", t.contact],
              ].map(([key, label]) => (
                <label className="inline-check" key={key}>
                  <input
                    type="checkbox"
                    checked={fields.includes(key)}
                    onChange={() =>
                      setFields(
                        fields.includes(key)
                          ? fields.filter((f) => f !== key)
                          : [...fields, key],
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
          <label>
            {t.reviewNote}
            <textarea
              required
              minLength={10}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <button className="button secondary small">
            {locale === "en" ? "Record review" : "Registrar revisión"}
          </button>
        </form>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </>
  );
}
