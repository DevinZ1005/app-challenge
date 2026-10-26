"use client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./context";
import {
  applicationReviewSchema,
  type ApplicationDetails,
  type ApplicationSummary,
  type ApplicationStatus,
} from "@/lib/provider-application-review";

function ReviewDialog({
  application,
  decision,
  onClose,
  onSaved,
}: {
  application: ApplicationDetails;
  decision: "approved" | "rejected";
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState("phone");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const data = new FormData(event.currentTarget);
    let contactedAt = "";
    if (decision === "approved") {
      const date = new Date(String(data.get("contactedAt")));
      if (Number.isFinite(date.getTime())) contactedAt = date.toISOString();
    }
    const parsed = applicationReviewSchema.safeParse({
      decision,
      note: data.get("note"),
      ...(decision === "approved"
        ? {
            sourceUrl: data.get("sourceUrl"),
            contactMethod: method,
            officialContact: data.get("officialContact"),
            contactedAt,
            affiliationConfirmed: data.get("affiliationConfirmed") === "on",
          }
        : {}),
    });
    if (!parsed.success) {
      setError(t.reviewInvalid);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/provider-applications/${application.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      if (response.ok) {
        onSaved();
        return;
      }
      setError(
        response.status === 409
          ? t.reviewConflict
          : response.status === 403
            ? t.reviewForbidden
            : response.status === 400 || response.status === 413
              ? t.reviewInvalid
              : t.reviewUnavailable,
      );
    } catch {
      setError(t.reviewUnavailable);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="application-review-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      style={{
        width: "min(94vw, 640px)",
        maxHeight: "90vh",
        overflowY: "auto",
        padding: 24,
        borderRadius: 12,
        border: "1px solid #cbd8cc",
      }}
    >
      <h3 id="application-review-title">
        {decision === "approved" ? t.reviewApproveTitle : t.reviewRejectTitle}
      </h3>
      <p>{application.organizationName}</p>
      <p>{t.reviewNoAccess}</p>
      <form method="post" onSubmit={submit} aria-busy={busy}>
        <label>
          {t.reviewReason}
          <textarea
            name="note"
            required
            minLength={10}
            maxLength={2000}
            rows={3}
          />
        </label>
        {decision === "approved" && (
          <fieldset disabled={busy}>
            <legend>{t.reviewEvidenceHint}</legend>
            <label>
              {t.reviewOfficialSource}
              <input
                name="sourceUrl"
                type="url"
                pattern="https://.*"
                required
                maxLength={1000}
              />
            </label>
            <label>
              {t.reviewContactMethod}
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
              >
                <option value="phone">{t.reviewPhone}</option>
                <option value="email">{t.reviewEmail}</option>
              </select>
            </label>
            <label>
              {t.reviewOfficialContact}
              <input
                name="officialContact"
                type={method === "email" ? "email" : "tel"}
                required
                maxLength={254}
              />
            </label>
            <label>
              {t.reviewContactTime}
              <input name="contactedAt" type="datetime-local" required />
            </label>
            <label className="inline-check">
              <input name="affiliationConfirmed" type="checkbox" required />
              {t.reviewAttestation}
            </label>
          </fieldset>
        )}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <div className="inline-fields">
          <button className="button" disabled={busy}>
            {decision === "approved"
              ? t.reviewConfirmApprove
              : t.reviewConfirmReject}
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            {t.cancel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function ProviderApplicationReview({
  adminEmail,
  onDecision,
}: {
  adminEmail: string;
  onDecision: () => void;
}) {
  const { t, locale } = useApp();
  const [status, setStatus] = useState<ApplicationStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<ApplicationDetails | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(
    null,
  );
  const [saved, setSaved] = useState(false);
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setListError(false);
      try {
        const response = await fetch(
          `/api/admin/provider-applications?status=${status}&page=${page}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!Array.isArray(data.applications) || !Number.isInteger(data.total))
          throw Error();
        if (!controller.signal.aborted) {
          setApplications(data.applications);
          setTotal(data.total);
        }
      } catch {
        if (!controller.signal.aborted) {
          setApplications([]);
          setListError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [status, page, refresh]);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    async function load() {
      setDetails(null);
      setDetailError(false);
      try {
        const response = await fetch(
          `/api/admin/provider-applications/${selectedId}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw Error();
        const data = await response.json();
        if (data.id !== selectedId) throw Error();
        if (!controller.signal.aborted) setDetails(data);
      } catch {
        if (!controller.signal.aborted) setDetailError(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [selectedId, refresh]);
  const selfReview =
    details?.contactEmail.trim().toLowerCase() ===
    adminEmail.trim().toLowerCase();
  return (
    <section
      className="info-panel"
      aria-labelledby="provider-application-review-heading"
    >
      <h2 id="provider-application-review-heading">
        {t.reviewApplicationsTitle}
      </h2>
      <p>{t.reviewNoAccess}</p>
      <div className="inline-fields">
        <label>
          {t.reviewStatusFilter}
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ApplicationStatus | "all");
              setPage(1);
            }}
          >
            <option value="all">{t.reviewAll}</option>
            {(["pending", "approved", "rejected"] as const).map((value) => (
              <option key={value} value={value}>
                {t[value]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button secondary"
          onClick={() => setRefresh((value) => value + 1)}
        >
          {t.reviewRefresh}
        </button>
      </div>
      {loading ? (
        <p role="status">{t.loading}</p>
      ) : listError ? (
        <p role="alert">{t.reviewUnavailable}</p>
      ) : (
        <>
          {!applications.length && <p>{t.reviewEmpty}</p>}
          <ul style={{ listStyle: "none", padding: 0 }}>
            {applications.map((application) => (
              <li
                key={application.id}
                style={{
                  paddingBlock: 12,
                  borderBottom: "1px solid #dce3df",
                  overflowWrap: "anywhere",
                }}
              >
                <strong>{application.organizationName}</strong>
                <p>
                  {t.reviewSubmitted}: {formatDate(application.createdAt)} ·{" "}
                  {t[application.status]}
                </p>
                <button
                  type="button"
                  className="button secondary small"
                  aria-label={`${t.reviewOpen}: ${application.organizationName}`}
                  onClick={() => {
                    setSelectedId(application.id);
                    setSaved(false);
                  }}
                >
                  {t.reviewOpen}
                </button>
              </li>
            ))}
          </ul>
          <div className="inline-fields">
            <button
              type="button"
              className="button secondary small"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              {t.reviewPrevious}
            </button>
            <span>
              {t.reviewPage} {page}
            </span>
            <button
              type="button"
              className="button secondary small"
              disabled={page * 25 >= total}
              onClick={() => setPage((value) => value + 1)}
            >
              {t.reviewNext}
            </button>
          </div>
        </>
      )}
      {saved && <p role="status">{t.reviewSaved}</p>}
      {selectedId && (
        <article className="detail-block" style={{ overflowWrap: "anywhere" }}>
          <button
            type="button"
            className="button secondary small"
            onClick={() => {
              setSelectedId(null);
              setDetails(null);
            }}
          >
            {t.reviewClose}
          </button>
          {detailError ? (
            <p role="alert">{t.reviewUnavailable}</p>
          ) : !details ? (
            <p role="status">{t.loading}</p>
          ) : (
            <>
              <h3>{details.organizationName}</h3>
              <dl>
                {[
                  [t.reviewSubmitted, formatDate(details.createdAt)],
                  [t.applicationAddress, details.organizationAddress],
                  [t.applicationContact, details.contactName],
                  [t.applicationEmail, details.contactEmail],
                  [t.applicationPhone, details.contactPhone || "—"],
                  [t.applicationDescription, details.description],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>
                      <strong>{label}</strong>
                    </dt>
                    <dd style={{ marginInlineStart: 0 }}>{value}</dd>
                  </div>
                ))}
              </dl>
              {details.organizationWebsite?.startsWith("https://") && (
                <p>
                  <a
                    href={details.organizationWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t.applicationWebsite}
                  </a>
                </p>
              )}
              <p>{t[details.status]}</p>
              {details.status === "pending" ? (
                <>
                  {selfReview && <p>{t.reviewSelf}</p>}
                  <div className="inline-fields">
                    <button
                      type="button"
                      className="button"
                      disabled={selfReview}
                      onClick={() => setDecision("approved")}
                    >
                      {t.approve}
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={selfReview}
                      onClick={() => setDecision("rejected")}
                    >
                      {t.reject}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>{t.reviewFinal}</p>
                  <p>
                    {t.reviewBy}: {details.reviewedBy}
                  </p>
                  <p>
                    {t.reviewAt}:{" "}
                    {details.reviewedAt && formatDate(details.reviewedAt)}
                  </p>
                  <p>
                    {t.reviewReason}: {details.reviewNote}
                  </p>
                  {details.verification && (
                    <div>
                      <p>
                        {t.reviewOfficialContact}:{" "}
                        {details.verification.contact}
                      </p>
                      <p>
                        {t.reviewContactMethod}:{" "}
                        {details.verification.method === "phone"
                          ? t.reviewPhone
                          : t.reviewEmail}
                      </p>
                      <p>
                        {t.reviewContactTime}:{" "}
                        {formatDate(details.verification.contactedAt)}
                      </p>
                      <a
                        href={details.verification.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t.reviewOfficialSource}
                      </a>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </article>
      )}
      {details && decision && (
        <ReviewDialog
          application={details}
          decision={decision}
          onClose={() => setDecision(null)}
          onSaved={() => {
            setDecision(null);
            setSaved(true);
            setPage(1);
            setRefresh((value) => value + 1);
            onDecision();
          }}
        />
      )}
    </section>
  );
}
