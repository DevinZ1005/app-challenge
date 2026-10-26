"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Globe, Leaf, Menu, X, Info, Heart } from "lucide-react";
import { useApp } from "./context";
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="PantryFit home">
      <span className="logo-mark">
        <Leaf size={23} strokeWidth={2} />
        <span />
      </span>
      <span>
        Pantry<span className="logo-fit">Fit</span>
        <span className="logo-dot">.</span>
      </span>
    </Link>
  );
}
export function Header() {
  const { t, locale, setLocale, demo, loadError, refresh } = useApp();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <>
      <a className="skip-link" href="#main">
        {locale === "en" ? "Skip to content" : "Ir al contenido"}
      </a>
      <header className="header">
        <div className="container header-inner">
          <Logo />
          <nav
            className={open ? "nav open" : "nav"}
            aria-label={
              locale === "en" ? "Main navigation" : "Navegación principal"
            }
          >
            {[
              ["/find", t.find],
              ["/how-it-works", t.how],
              ["/for-providers", t.providers],
            ].map(([href, label]) => (
              <Link
                onClick={() => setOpen(false)}
                className={path === href ? "active" : ""}
                href={href}
                key={href}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="language"
              onClick={() => setLocale(locale === "en" ? "es" : "en")}
              aria-label={
                locale === "en" ? "Cambiar a español" : "Switch to English"
              }
            >
              <Globe size={17} />
              <span>{locale === "en" ? "Español" : "English"}</span>
            </button>
            <Link href="/find" className="button small header-cta">
              {t.find}
              <ArrowUpRight size={16} />
            </Link>
            <button
              className="mobile-menu icon-button"
              aria-expanded={open}
              aria-label="Menu"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      {demo && (
        <div className="demo-bar">
          <div className="container">
            <span className="demo-pill">{t.demo}</span>
            <span>{t.demoNotice}</span>
            <a
              className="official-link"
              href="https://finder.nyc.gov/foodhelp/locations"
              target="_blank"
              rel="noopener noreferrer"
            >
              {locale === "en"
                ? "Find real services ↗"
                : "Buscar servicios reales ↗"}
            </a>
          </div>
        </div>
      )}
      {loadError && (
        <div className="container notice" role="alert">
          <span>{t.error}</span>
          <button type="button" className="text-link" onClick={refresh}>
            {locale === "en" ? "Try again" : "Intentar otra vez"}
          </button>
        </div>
      )}
    </>
  );
}
export function Footer() {
  const { t } = useApp();
  return (
    <footer>
      <div className="container">
        <div className="footer-top">
          <div>
            <Logo />
            <p>{t.tagline}</p>
          </div>
          <div className="footer-links">
            <Link href="/how-it-works">{t.how}</Link>
            <Link href="/privacy">{t.privacy}</Link>
            <Link href="/about">{t.about}</Link>
            <Link href="/about#feedback">
              {t.feedback}
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 PantryFit · {t.footerText}</span>
          <span>
            <Heart size={13} /> Bronx, New York
          </span>
        </div>
        <p className="footer-warning">
          <Info size={14} />
          {t.warning}
        </p>
      </div>
    </footer>
  );
}
