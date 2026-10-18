"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  LogOut,
  Plus,
  Trash2,
  Check,
  Clock,
  LoaderCircle,
} from "lucide-react";
import { AdminTools } from "./admin-tools";
import { useApp } from "./context";
import type { Provider, FoodOffering, TimeInterval } from "@/lib/model";
import type { ChangeRequest, AuditEntry } from "@/lib/updates";
import { updateSchema } from "@/lib/updates";
interface Account {
  id: string;
  email: string;
  role: "provider" | "admin";
  programIds: string[];
  changes: ChangeRequest[];
  audit: AuditEntry[];
  demo: boolean;
  feedback: { id: string; message: string; createdAt: string }[];
}
export function Login() {
  const { t, demoAuth } = useApp();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ email: string; password: string }>();
  const [error, setError] = useState("");
  async function submit(v: { email: string; password: string }) {
    setError("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      if (!r.ok) throw Error();
      const who = await fetch("/api/auth/me").then((r) => r.json());
      router.push(who.role === "admin" ? "/admin" : "/provider/dashboard");
    } catch {
      setError(t.loginError);
    }
  }
  return (
    <section className="container login-page">
      <div className="login-card">
        <span className="feature-icon">
          <ShieldCheck />
        </span>
        <span className="eyebrow">PANTRYFIT · {t.providers}</span>
        <h1>{t.loginTitle}</h1>
        <form onSubmit={handleSubmit(submit)}>
          <label>
            {t.email}
            <input
              type="email"
              autoComplete="username"
              required
              {...register("email", { required: true })}
            />
          </label>
          <label>
            {t.password}
            <input
              type="password"
              autoComplete="current-password"
              required
              {...register("password", { required: true })}
            />
          </label>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <button className="button full" disabled={isSubmitting}>
            {isSubmitting ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              t.login
            )}
            <ArrowRight size={17} />
          </button>
        </form>
        {demoAuth && (
          <div className="notice demo-credentials">
            <strong>{t.demoLogin}</strong>
            <p>{t.demoLoginText}</p>
          </div>
        )}
      </div>
    </section>
  );
}
function ProgramForm({
  provider,
  onSaved,
}: {
  provider: Provider;
  onSaved: () => void;
}) {
  const { t, locale } = useApp();
  const [hours, setHours] = useState<TimeInterval[]>(
    provider.program.hours || [],
  );
  const [exceptions, setExceptions] = useState(provider.program.exceptions);
  const [offerings, setOfferings] = useState<FoodOffering[] | null>(
    provider.program.offerings,
  );
  const [appointment, setAppointment] = useState(provider.program.appointment);
  const [phone, setPhone] = useState(provider.phone || "");
  const [eligibility, setEligibility] = useState(
    provider.program.eligibility || { en: "", es: "" },
  );
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const tm = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  const num = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  function offer(i: number, patch: Partial<FoodOffering>) {
    setOfferings(
      (old) => old?.map((o, j) => (i === j ? { ...o, ...patch } : o)) || null,
    );
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const parsed = updateSchema.safeParse({
      programId: provider.id,
      hours: hours.length ? hours : null,
      exceptions,
      offerings,
      appointment,
      phone,
      eligibility: eligibility.en || eligibility.es ? eligibility : null,
      note,
    });
    if (!parsed.success) {
      setMessage(t.saveError);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!r.ok) throw Error();
      setMessage(t.saved);
      setNote("");
      onSaved();
    } catch {
      setMessage(t.saveError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="provider-form" onSubmit={submit}>
      <div className="detail-block">
        <h2>{t.providerUpdate}</h2>
        <p>{t.updateLabel}</p>
        <h3>{t.hours}</h3>
        {hours.map((h, i) => (
          <div className="hours-edit-row" key={i}>
            <label>
              <span className="sr-only">{t.day}</span>
              <select
                value={h.day}
                onChange={(e) =>
                  setHours(
                    hours.map((v, j) =>
                      j === i ? { ...v, day: +e.target.value } : v,
                    ),
                  )
                }
              >
                {t.fullDays.map((d, j) => (
                  <option value={j} key={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.start}
              <input
                type="time"
                required
                value={tm(h.start)}
                onChange={(e) =>
                  setHours(
                    hours.map((v, j) =>
                      j === i ? { ...v, start: num(e.target.value) } : v,
                    ),
                  )
                }
              />
            </label>
            <label>
              {t.end}
              <input
                type="time"
                required
                value={tm(h.end)}
                onChange={(e) =>
                  setHours(
                    hours.map((v, j) =>
                      j === i ? { ...v, end: num(e.target.value) } : v,
                    ),
                  )
                }
              />
            </label>
            <button
              aria-label={t.remove}
              type="button"
              className="icon-button"
              onClick={() => setHours(hours.filter((_, j) => j !== i))}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button secondary small"
          onClick={() => setHours([...hours, { day: 0, start: 540, end: 720 }])}
        >
          <Plus size={16} />
          {t.addWindow}
        </button>
        <h3>
          {locale === "en" ? "Exceptional closures" : "Cierres excepcionales"}
        </h3>
        {exceptions.map((e, i) => (
          <div className="inline-fields" key={i}>
            <label>
              {locale === "en" ? "Closure date" : "Fecha de cierre"}
              <input
                type="date"
                required
                value={e.date}
                onChange={(ev) =>
                  setExceptions(
                    exceptions.map((v, j) =>
                      i === j ? { date: ev.target.value, closed: true } : v,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              aria-label={t.remove}
              className="icon-button"
              onClick={() =>
                setExceptions(exceptions.filter((_, j) => j !== i))
              }
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-link"
          onClick={() =>
            setExceptions([
              ...exceptions,
              { date: new Date().toISOString().slice(0, 10), closed: true },
            ])
          }
        >
          <Plus size={16} />
          {locale === "en" ? "Add closure" : "Añadir cierre"}
        </button>
      </div>
      <div className="detail-block">
        <h2>{t.offerings}</h2>
        {!offerings?.length && <p>{t.unknownFood}</p>}
        {offerings?.map((o, i) => (
          <fieldset className="offering-edit" key={i}>
            <legend>
              {i + 1}. {t.food}
            </legend>
            <div className="inline-fields">
              <label>
                English
                <input
                  required
                  maxLength={240}
                  value={o.name.en}
                  onChange={(e) =>
                    offer(i, { name: { ...o.name, en: e.target.value } })
                  }
                />
              </label>
              <label>
                Español
                <input
                  required
                  maxLength={240}
                  value={o.name.es}
                  onChange={(e) =>
                    offer(i, { name: { ...o.name, es: e.target.value } })
                  }
                />
              </label>
            </div>
            <label>
              {t.storageTitle}
              <select
                value={o.storage}
                onChange={(e) =>
                  offer(i, {
                    storage: e.target.value as FoodOffering["storage"],
                  })
                }
              >
                <option value="shelf">{t.shelf}</option>
                <option value="cold">
                  {locale === "en"
                    ? "Requires refrigeration"
                    : "Requiere refrigeración"}
                </option>
                <option value="unknown">{t.unknownFood}</option>
              </select>
            </label>
            <fieldset className="inline-fields">
              <legend>{t.equipmentTitle}</legend>
              {(["none", "microwave", "stovetop", "oven"] as const).map((v) => (
                <label className="inline-check" key={v}>
                  <input
                    type="checkbox"
                    checked={o.equipment.includes(v)}
                    onChange={() =>
                      offer(i, {
                        equipment: o.equipment.includes(v)
                          ? o.equipment.filter((k) => k !== v)
                          : [...o.equipment, v],
                      })
                    }
                  />
                  {t[v]}
                </label>
              ))}
            </fieldset>
            <fieldset className="inline-fields">
              <legend>{t.dietTitle}</legend>
              {(["vegetarian", "vegan", "halal", "kosher"] as const).map(
                (v) => (
                  <label className="inline-check" key={v}>
                    <input
                      type="checkbox"
                      checked={o.diets.includes(v)}
                      onChange={() =>
                        offer(i, {
                          diets: o.diets.includes(v)
                            ? o.diets.filter((k) => k !== v)
                            : [...o.diets, v],
                        })
                      }
                    />
                    {t[v]}
                  </label>
                ),
              )}
            </fieldset>
            <button
              type="button"
              className="text-link"
              onClick={() => setOfferings(offerings.filter((_, j) => j !== i))}
            >
              <Trash2 size={15} />
              {t.remove}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="button secondary small"
          onClick={() =>
            setOfferings([
              ...(offerings || []),
              {
                name: { en: "", es: "" },
                equipment: ["none"],
                storage: "unknown",
                diets: [],
                verified: false,
              },
            ])
          }
        >
          <Plus size={16} />
          {t.food}
        </button>
      </div>
      <div className="detail-block">
        <h2>{t.eligibility}</h2>
        <label>
          {t.appointment}
          <select
            value={appointment}
            onChange={(e) =>
              setAppointment(e.target.value as typeof appointment)
            }
          >
            <option value="yes">{t.yes}</option>
            <option value="no">{t.no}</option>
            <option value="unknown">{t.unknown}</option>
          </select>
        </label>
        <div className="inline-fields">
          <label>
            {t.eligibility} · English
            <textarea
              maxLength={240}
              value={eligibility.en}
              onChange={(e) =>
                setEligibility({ ...eligibility, en: e.target.value })
              }
            />
          </label>
          <label>
            {t.eligibility} · Español
            <textarea
              maxLength={240}
              value={eligibility.es}
              onChange={(e) =>
                setEligibility({ ...eligibility, es: e.target.value })
              }
            />
          </label>
        </div>
        <label>
          {t.contact}
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={30}
          />
        </label>
        <label>
          {t.note}
          <textarea
            required
            minLength={5}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="inline-fields">
          <button className="button" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Check size={17} />
            )}{" "}
            {t.save}
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => window.location.reload()}
          >
            {t.cancel}
          </button>
        </div>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
export function Dashboard({ admin = false }: { admin?: boolean }) {
  const { t, locale, providers, refresh } = useApp();
  const [account, setAccount] = useState<Account | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const router = useRouter();
  function load() {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) throw Error();
        const a = await r.json();
        setAccount(a);
        setSelected(
          (v) =>
            v ||
            (a.role === "admin" ? providers[0]?.id : a.programIds[0]) ||
            "",
        );
      })
      .catch(() => setAccount(null))
      .finally(() => setLoaded(true));
  }
  useEffect(() => {
    load(); /* account is fetched once; refresh is explicit after writes. */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function review(id: string, status: "approved" | "rejected") {
    setMessage("");
    try {
      const r = await fetch("/api/changes/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: reviewNotes[id] || "" }),
      });
      if (!r.ok) throw Error();
      refresh();
      load();
    } catch {
      setMessage(t.saveError);
    }
  }
  async function logout() {
    try {
      const r = await fetch("/api/auth/logout", { method: "POST" });
      if (!r.ok) throw Error();
      router.push("/provider/login");
    } catch {
      setMessage(t.error);
    }
  }
  if (!loaded)
    return (
      <section className="container page-space" role="status">
        {t.loading}
      </section>
    );
  if (!account || (admin && account.role !== "admin"))
    return (
      <section className="container page-space">
        <h1>{t.loginRequired}</h1>
        <Link className="button" href="/provider/login">
          {t.login}
        </Link>
      </section>
    );
  const allowed = providers.filter(
    (p) => account.role === "admin" || account.programIds.includes(p.id),
  );
  const provider = allowed.find((p) => p.id === selected) || allowed[0];
  return (
    <section className="container dashboard-page">
      <div className="page-intro row">
        <div>
          <span className="eyebrow">{account.demo ? t.demo : "PANTRYFIT"}</span>
          <h1>{admin ? t.admin : t.dashboard}</h1>
          <p>
            {t.signedIn} {account.email}
          </p>
        </div>
        <button className="button secondary" onClick={logout}>
          <LogOut size={16} />
          {t.logout}
        </button>
      </div>
      {admin && (
        <div className="notice">
          <ShieldCheck />
          {t.adminText}
        </div>
      )}
      <div className="dashboard-grid">
        <div>
          <label>
            {t.published}
            <select
              value={provider?.id || ""}
              onChange={(e) => setSelected(e.target.value)}
            >
              {allowed.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name[locale]}
                </option>
              ))}
            </select>
          </label>
          {provider ? (
            <ProgramForm
              key={provider.id + provider.updatedAt}
              provider={provider}
              onSaved={load}
            />
          ) : (
            <div className="notice">{t.accessText}</div>
          )}
        </div>
        <aside>
          {admin && provider && (
            <AdminTools
              programId={provider.id}
              onSaved={() => {
                refresh();
                load();
              }}
            />
          )}
          <div className="detail-block">
            <h2>{t.changes}</h2>
            {!account.changes.length && <p>{t.noChanges}</p>}
            {account.changes.map((c) => (
              <article className="change-card" key={c.id}>
                <span className={"status-pill " + c.status}>{t[c.status]}</span>
                <h3>
                  {providers.find((p) => p.id === c.programId)?.name[locale] ||
                    c.programId}
                </h3>
                <p>{c.payload.note}</p>
                <small>{new Date(c.submittedAt).toLocaleString(locale)}</small>
                <details>
                  <summary>{t.details}</summary>
                  <pre>{JSON.stringify(c.payload, null, 2)}</pre>
                </details>
                {c.reviewNote && <p>{c.reviewNote}</p>}
                {admin && c.status === "pending" && (
                  <>
                    <label>
                      {t.reviewNote}
                      <textarea
                        minLength={5}
                        maxLength={1000}
                        value={reviewNotes[c.id] || ""}
                        onChange={(e) =>
                          setReviewNotes({
                            ...reviewNotes,
                            [c.id]: e.target.value,
                          })
                        }
                      />
                    </label>
                    <div className="inline-fields">
                      <button
                        className="button small"
                        onClick={() => review(c.id, "approved")}
                      >
                        {t.approve}
                      </button>
                      <button
                        className="button secondary small"
                        onClick={() => review(c.id, "rejected")}
                      >
                        {t.reject}
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
          <div className="detail-block">
            <h2>{t.audit}</h2>
            {account.audit.map((a) => (
              <p className="audit-entry" key={a.id}>
                <Clock size={14} />
                {t[a.action as "submitted" | "approved" | "rejected"] ||
                  (
                    {
                      listing_created: t.listingCreated,
                      verification_recorded: t.verificationRecorded,
                      flag_outdated: t.flagOutdated,
                    } as Record<string, string>
                  )[a.action] ||
                  a.action}
                <small>{new Date(a.at).toLocaleString(locale)}</small>
                {a.notes && <span>{a.notes}</span>}
              </p>
            ))}
          </div>
          {admin && (
            <div className="detail-block">
              <h2>{t.feedback}</h2>
              {account.feedback?.map((f) => (
                <p key={f.id}>
                  {f.message}
                  <small>
                    {" "}
                    · {new Date(f.createdAt).toLocaleDateString(locale)}
                  </small>
                </p>
              ))}
            </div>
          )}
        </aside>
      </div>
      {message && (
        <p role="alert" className="error-message">
          {message}
        </p>
      )}
    </section>
  );
}
