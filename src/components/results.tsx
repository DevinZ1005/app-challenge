"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  CircleHelp,
  SlidersHorizontal,
  Map,
  List,
  Phone,
  ExternalLink,
  ShieldAlert,
  ShoppingBasket,
} from "lucide-react";
import { useApp } from "./context";
import { rankProviders } from "@/lib/matching";
import type { MatchResult, MatchExplanation, Provider } from "@/lib/model";
import type { en } from "@/lib/i18n";
function reason(e: MatchExplanation, t: typeof en) {
  if (e.code === "conflict") return t.conflict;
  const key =
    e.factor +
    (e.state === "compatible"
      ? "Compatible"
      : e.state === "incompatible"
        ? "Incompatible"
        : "Unknown") +
    (e.state === "unknown" && ["travel", "eligibility"].includes(e.factor)
      ? "Reason"
      : "");
  return (
    (t as unknown as Record<string, string>)[key] || t.eligibilityUnknownReason
  );
}
export function Hours({ provider }: { provider: Provider }) {
  const { t } = useApp();
  if (!provider.program.hours?.length) return <p>{t.hoursUnknown}</p>;
  const time = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  return (
    <ul className="hours-list">
      {provider.program.hours.map((h, i) => (
        <li key={i}>
          <span>{t.fullDays[h.day]}</span>
          <span>
            {time(h.start)}–{time(h.end)}
          </span>
        </li>
      ))}
    </ul>
  );
}
export function Explanation({ result }: { result: MatchResult }) {
  const { t } = useApp();
  const good = result.explanations.filter((e) => e.state === "compatible");
  const others = result.explanations.filter((e) => e.state !== "compatible");
  return (
    <div className="explanation">
      <div>
        <strong>
          <CheckCircle2 size={17} />
          {t.why}
        </strong>
        <ul>
          {good.map((e, i) => (
            <li key={i}>{reason(e, t)}</li>
          ))}
        </ul>
      </div>
      <div>
        <strong>
          <CircleHelp size={17} />
          {t.confirm}
        </strong>
        <ul>
          {others.map((e, i) => (
            <li key={i}>{reason(e, t)}</li>
          ))}
          {result.stale && <li>{t.freshness}</li>}
          {result.provider.program.appointment !== "no" && (
            <li>
              {result.provider.program.appointment === "yes"
                ? t.appointmentYes
                : t.appointmentUnknown}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
function MatchCard({ result }: { result: MatchResult }) {
  const { t, locale } = useApp();
  const p = result.provider;
  return (
    <article className="match-card">
      <div className="match-card-top">
        <div>
          <span className="service-type">
            {p.program.type === "community"
              ? t.communityType
              : t[p.program.type]}
            {p.demo && " · " + t.fictional}
          </span>
          <h2>
            <Link href={"/providers/" + p.id}>{p.name[locale]}</Link>
          </h2>
          <p className="meta">
            <MapPin size={15} />
            {p.address[locale]}
          </p>
        </div>
        <span className={"match-badge " + result.category}>
          {result.category === "strong" ? (
            <CheckCircle2 size={15} />
          ) : result.category === "possible" ? (
            <CircleHelp size={15} />
          ) : (
            <AlertCircle size={15} />
          )}{" "}
          {t[result.category]}
        </span>
      </div>
      <div className="match-info">
        <div>
          <Clock size={17} />
          <div>
            <strong>{t.hours}</strong>
            <Hours provider={p} />
          </div>
        </div>
        <div>
          <MapPin size={17} />
          <div>
            <strong>
              {result.distanceKm !== null
                ? `${result.distanceKm.toFixed(1)} km · ${locale === "en" ? "straight-line" : "en línea recta"}`
                : t.distanceUnknown}
            </strong>
            <p>{t.travelUnknown}</p>
          </div>
        </div>
        <div>
          <ShieldAlert size={17} />
          <div>
            <strong>
              {p.verifiedAt
                ? new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                  }).format(new Date(p.verifiedAt))
                : t.notVerified}
            </strong>
            <p>{p.verifiedAt ? t.verified : t.confirm}</p>
          </div>
        </div>
      </div>
      <div className="score-row">
        <span>
          {result.confidence > 0 ? (
            <>
              <b>{result.score}%</b> {t.fit}
            </>
          ) : (
            t.noKnown
          )}
        </span>
        <span>
          {result.confidence}% {t.confidence}
        </span>
      </div>
      <details className="match-details">
        <summary>
          {t.why}
          <span>+</span>
        </summary>
        <Explanation result={result} />
      </details>
      <div className="match-card-bottom">
        <Link href={"/providers/" + p.id} className="text-link">
          {t.details}
          <ArrowRight size={16} />
        </Link>
        {p.phone && p.phoneVerified && !p.demo && (
          <a className="text-link" href={"tel:" + p.phone}>
            <Phone size={16} />
            {t.call}
          </a>
        )}
      </div>
    </article>
  );
}
export function Results() {
  const { t, preferences, providers } = useApp();
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("quality");
  const [possible, setPossible] = useState(true);
  const [view, setView] = useState("list");
  const matches = rankProviders(preferences, providers);
  let filtered = matches.filter(
    (r) =>
      (type === "all" || r.provider.program.type === type) &&
      (possible || r.category === "strong"),
  );
  if (sort === "distance")
    filtered = [...filtered].sort(
      (a, b) =>
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
        a.provider.id.localeCompare(b.provider.id),
    );
  const suitable = filtered.filter((r) => r.category !== "unsuitable");
  const unsuitable = matches.filter(
    (r) =>
      r.category === "unsuitable" &&
      (type === "all" || r.provider.program.type === type),
  );
  return (
    <section className="container results-page">
      <div className="page-intro row">
        <div>
          <span className="eyebrow">PANTRYFIT · {preferences.zip}</span>
          <h1>{t.resultsTitle}</h1>
          <p>{t.resultsIntro}</p>
        </div>
        <Link href="/find" className="button secondary">
          <SlidersHorizontal size={17} />
          {t.edit}
        </Link>
      </div>
      <div className="results-layout">
        <aside className="filters">
          <h2>
            <SlidersHorizontal size={18} />
            {t.find}
          </h2>
          <label>
            {t.sort}
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="quality">{t.quality}</option>
              <option value="distance">{t.distance}</option>
            </select>
          </label>
          <label>
            {t.type}
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">{t.all}</option>
              <option value="pantry">{t.pantry}</option>
              <option value="meals">{t.meals}</option>
              <option value="community">{t.communityType}</option>
            </select>
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={possible}
              onChange={(e) => setPossible(e.target.checked)}
            />
            {t.showPossible}
          </label>
          <div className="notice">
            <CircleHelp size={20} />
            {t.warning}
          </div>
          <Link href="/how-it-works" className="text-link">
            {t.scoreTitle}
            <ArrowRight size={15} />
          </Link>
        </aside>
        <div className="results-list">
          <div className="results-toolbar">
            <span>
              <strong>{suitable.length}</strong> {t.matches}
            </span>
            <div className="segmented">
              <button
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <List size={17} />
                {t.list}
              </button>
              <button
                aria-pressed={view === "map"}
                onClick={() => setView("map")}
              >
                <Map size={17} />
                {t.map}
              </button>
            </div>
          </div>
          {view === "map" && (
            <div className="notice map-notice">
              <MapPin />
              {t.mapNote}
            </div>
          )}
          {suitable.length ? (
            suitable.map((r) => <MatchCard key={r.provider.id} result={r} />)
          ) : (
            <div className="empty-state">
              <ShoppingBasket size={40} />
              <h2>{t.noResults}</h2>
              <p>{t.noResultsText}</p>
              <Link href="/find" className="button secondary">
                {t.edit}
              </Link>
            </div>
          )}
          {unsuitable.length > 0 && (
            <section className="unsuitable-section">
              <h2>{t.notSuitable}</h2>
              <p>{t.notSuitableText}</p>
              {unsuitable.map((r) => (
                <MatchCard key={r.provider.id} result={r} />
              ))}
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
export function ProviderDetail({ id }: { id: string }) {
  const { t, locale, providers, preferences } = useApp();
  const p = providers.find((v) => v.id === id);
  if (!p)
    return (
      <section className="container page-space">
        <h1>{t.noResults}</h1>
        <Link href="/results">{t.backResults}</Link>
      </section>
    );
  const result = rankProviders(preferences, [p])[0];
  return (
    <section className="container detail-page">
      <Link href="/results" className="text-link">
        <ArrowLeft size={17} />
        {t.backResults}
      </Link>
      <div className="detail-heading">
        <span className="eyebrow">
          {p.program.type === "community" ? t.communityType : t[p.program.type]}
        </span>
        <h1>{p.name[locale]}</h1>
        <p>
          <MapPin size={17} />
          {p.address[locale]}
        </p>
      </div>
      {(result.stale || p.demo) && (
        <div className="notice warning-notice">
          <ShieldAlert size={22} />
          <div>
            <strong>{p.demo ? t.fictional : t.notVerified}</strong>
            <p>{p.demo ? t.demoNotice : t.freshness}</p>
          </div>
        </div>
      )}
      <div className="detail-grid">
        <div>
          <div className="detail-block">
            <h2>{t.description}</h2>
            <p>{p.description[locale]}</p>
          </div>
          <div className="detail-block">
            <h2>{t.offerings}</h2>
            {p.program.offerings?.length ? (
              <ul>
                {p.program.offerings.map((o, i) => (
                  <li key={i}>
                    {o.name[locale]} {!o.verified && " · " + t.confirm}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t.unknownFood}</p>
            )}
          </div>
          <div className="detail-block">
            <h2>{t.why}</h2>
            <span className={"match-badge " + result.category}>
              {t[result.category]}
            </span>
            <Explanation result={result} />
          </div>
          <div className="detail-block">
            <h2>{t.eligibility}</h2>
            <p>{p.program.eligibility?.[locale] || t.eligibilityUnknown}</p>
            <h3>{t.appointment}</h3>
            <p>
              {p.program.appointment === "yes"
                ? t.appointmentYes
                : p.program.appointment === "no"
                  ? t.appointmentNo
                  : t.appointmentUnknown}
            </p>
            <h3>{t.accessibility}</h3>
            <p>{p.accessibility?.[locale] || t.accessibilityUnknown}</p>
          </div>
        </div>
        <aside>
          <div className="detail-aside">
            <h2>
              <Clock size={20} />
              {t.hours}
            </h2>
            <Hours provider={p} />
            <p className="small-text">America/New_York</p>
            {p.program.exceptions.length > 0 && (
              <ul>
                {p.program.exceptions.map((e, i) => (
                  <li key={i}>
                    {e.date} ·{" "}
                    {e.closed
                      ? locale === "en"
                        ? "Closed"
                        : "Cerrado"
                      : locale === "en"
                        ? "Confirm hours"
                        : "Confirma el horario"}
                  </li>
                ))}
              </ul>
            )}
            <hr />
            {!p.demo && p.coordinatesVerified ? (
              <a
                className="button full"
                href={`https://www.openstreetmap.org/directions?to=${p.coordinates.lat},${p.coordinates.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.directions}
                <ExternalLink size={16} />
              </a>
            ) : (
              <p className="notice">{t.noDirections}</p>
            )}
            {p.phoneVerified && p.phone && !p.demo && (
              <a className="button secondary full" href={"tel:" + p.phone}>
                <Phone size={16} />
                {t.call}
              </a>
            )}
            <hr />
            <h3>{t.source}</h3>
            <p>{p.source.name[locale]}</p>
            {p.source.url && (
              <a
                className="text-link"
                href={p.source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.source}
                <ExternalLink size={14} />
              </a>
            )}
            <h3>{t.verified}</h3>
            <p>
              {p.verifiedAt
                ? new Date(p.verifiedAt).toLocaleDateString(locale)
                : t.notVerified}
            </p>
            <p className="small-text">{t.updateLabel}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
