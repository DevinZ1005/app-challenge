"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Globe,
  CalendarDays,
  CookingPot,
  ClipboardCheck,
  MapPin,
  Leaf,
  Utensils,
  ShoppingBasket,
  Heart,
  Check,
} from "lucide-react";
import { useApp } from "./context";
import { Neighborhood } from "./neighborhood";
export function Home() {
  const { t, locale, providers, demo } = useApp();
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> {t.local}
          </div>
          <h1>
            {t.heroA} <span>{t.heroB}</span>
            <svg viewBox="0 0 280 14" aria-hidden="true">
              <path
                d="M4 10 Q140 -4 276 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </svg>
          </h1>
          <p className="hero-subtitle">{t.tagline}</p>
          <p className="hero-description">{t.intro}</p>
          <div className="hero-buttons">
            <Link href="/find" className="button">
              {t.cta}
              <ArrowRight size={19} />
            </Link>
            <Link href="/how-it-works" className="text-link">
              {t.secondary}
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="trust-row">
            <span>
              <ShieldCheck />
              {t.noAccount}
            </span>
            <span>
              <Heart />
              {t.private}
            </span>
            <span>
              <Globe />
              {t.bilingual}
            </span>
          </div>
        </div>
        <Neighborhood />
      </section>
      <section className="features-section">
        <div className="container">
          <div className="section-heading center">
            <span className="eyebrow">{t.tagline}</span>
            <h2>{t.built}</h2>
            <p>{t.builtText}</p>
          </div>
          <div className="feature-grid">
            {[
              [CalendarDays, t.schedule, t.scheduleText],
              [CookingPot, t.food, t.foodText],
              [ClipboardCheck, t.clarity, t.clarityText],
            ].map(([Icon, title, text], i) => {
              const I = Icon as typeof CalendarDays;
              return (
                <div className="feature" key={i}>
                  <span className={"feature-icon feature-icon-" + i}>
                    <I size={24} />
                  </span>
                  <h3>{title as string}</h3>
                  <p>{text as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="container process-strip" aria-label={t.stepsTitle}>
        {[t.step1, t.step2, t.step3].map((text, i) => (
          <div key={text}>
            <b aria-hidden="true">{i + 1}</b>
            <p>{text}</p>
          </div>
        ))}
      </section>
      <section className="container explore-section">
        <div className="section-heading row">
          <div>
            <span className="eyebrow">
              {locale === "en"
                ? "POSSIBILITIES, NOT PROMISES"
                : "OPCIONES, NO PROMESAS"}
            </span>
            <h2>{t.explore}</h2>
            <p>{t.exploreText}</p>
          </div>
          <Link href="/results" className="text-link">
            {demo ? t.allServices : t.find}
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="preview-grid">
          {providers.slice(0, 3).map((p, i) => {
            const Icon = [ShoppingBasket, Utensils, Leaf][i];
            return (
              <Link
                href={"/providers/" + p.id}
                className="preview-card"
                key={p.id}
              >
                <div className={"preview-art art-" + i}>
                  <div className="art-circle" />
                  <Icon size={64} strokeWidth={1.3} />
                  {p.demo && <span className="card-demo">{t.fictional}</span>}
                  <div className="art-leaf one" />
                  <div className="art-leaf two" />
                </div>
                <div className="preview-content">
                  <span className="service-type">
                    {p.program.type === "community"
                      ? t.communityType
                      : t[p.program.type]}
                  </span>
                  <h3>
                    {p.name[locale]}
                    <ArrowUpRight size={19} />
                  </h3>
                  <p>
                    <MapPin size={14} />
                    {p.address[locale]}
                  </p>
                  <div className="card-divider" />
                  <span className="food-tag">
                    <Check size={14} />
                    {p.program.offerings?.some(
                      (o) => o.verified && o.storage === "shelf",
                    )
                      ? p.program.type === "meals"
                        ? t.ready
                        : t.shelf
                      : t.unknownFood}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        <p className="demo-footnote">{demo ? t.demoNotice : t.warning}</p>
      </section>
      <section className="container community-section">
        <div className="community-art" aria-hidden="true">
          <div className="community-heart">
            <Heart size={58} strokeWidth={1.4} />
          </div>
          <span className="orbit-dot dot-one" />
          <span className="orbit-dot dot-two" />
          <Leaf className="community-leaf" size={44} />
          <span className="community-small">10468</span>
          <div className="community-orbit" />
        </div>
        <div>
          <span className="eyebrow">{t.community}</span>
          <h2>{t.communityTitle}</h2>
          <p>{t.communityText}</p>
          <Link className="text-link" href="/about">
            {t.learn}
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}
