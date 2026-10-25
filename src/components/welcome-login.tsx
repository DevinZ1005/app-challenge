"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, Mail, ShieldCheck, LoaderCircle } from "lucide-react";
import { useApp } from "./context";
import { Pip } from "./pip";

export function WelcomeLogin({
  demo,
  enabled,
}: {
  demo: boolean;
  enabled: boolean;
}) {
  const { locale } = useApp();
  const en = locale === "en";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        sent ? "/api/household/verify" : "/api/household/code",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            sent
              ? { email: email.trim(), code: code.trim() }
              : { email: email.trim() },
          ),
        },
      );
      if (!response.ok) {
        setError(
          response.status === 429
            ? en
              ? "Too many attempts. Please wait before trying again."
              : "Demasiados intentos. Espera antes de intentarlo otra vez."
            : sent
              ? en
                ? "That code is invalid or expired. Check it or request a new one."
                : "El código no es válido o caducó. Revísalo o pide otro."
              : en
                ? "We couldn’t request a code right now. Please try again later."
                : "No pudimos solicitar el código. Inténtalo más tarde.",
        );
        return;
      }
      if (sent) window.location.assign(en ? "/find" : "/find?lang=es");
      else setSent(true);
    } catch {
      setError(
        en
          ? "Connection interrupted. Please try again."
          : "Conexión interrumpida. Inténtalo otra vez.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function preview() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/household/demo", { method: "POST" });
      if (!r.ok) throw Error();
      window.location.assign(en ? "/find" : "/find?lang=es");
    } catch {
      setError(
        en
          ? "The preview couldn’t open. Please try again shortly."
          : "No se pudo abrir la demo. Inténtalo en un momento.",
      );
      setBusy(false);
    }
  }
  return (
    <section className="welcome-page container">
      <div className="welcome-story">
        <span className="eyebrow">
          {en
            ? "SMALL STEPS. GOOD FOOD. A LITTLE HELP."
            : "PASOS PEQUEÑOS. BUENA COMIDA. UN POCO DE AYUDA."}
        </span>
        <h1>
          {en
            ? "Good food starts with a little hello."
            : "La buena comida empieza con un hola."}
        </h1>
        <div className="welcome-pip">
          <Pip />
          <div className="pip-hello">
            {en ? "Hi, I’m Pip!" : "¡Hola, soy Pip!"}
            <span>
              {en ? "Your little food buddy 🌱" : "Tu compañero de comida 🌱"}
            </span>
          </div>
        </div>
        <p>
          {en
            ? "I’ll help you find food that fits your day, your kitchen and your budget. We’ll take it one question at a time."
            : "Te ayudaré a encontrar comida que se adapte a tu día, tu cocina y tu presupuesto. Una pregunta a la vez."}
        </p>
        <div className="welcome-tags">
          <span>{en ? "Budget-friendly ideas" : "Ideas económicas"}</span>
          <span>{en ? "No judgment, just help" : "Ayuda sin juzgar"}</span>
        </div>
      </div>
      <div className="welcome-card">
        <span className="feature-icon">
          <Mail />
        </span>
        <h2>
          {sent
            ? en
              ? "Check your inbox"
              : "Revisa tu correo"
            : en
              ? "Welcome to PantryFit"
              : "Te damos la bienvenida"}
        </h2>
        <p>
          {sent
            ? en
              ? "If email delivery is available, a one-time code is on its way. Enter it below."
              : "Si el envío está disponible, recibirás un código de un solo uso. Escríbelo abajo."
            : en
              ? "Sign in or create your account with an email code."
              : "Inicia sesión o crea tu cuenta con un código por correo."}
        </p>
        {demo ? (
          <div className="login-demo-note">
            <strong>
              {en
                ? "You’re trying the local demo"
                : "Estás probando la demo local"}
            </strong>
            <p>
              {en
                ? "Email sign-in isn’t connected yet. Meet Pip and explore fictional services without entering personal details."
                : "El inicio por correo aún no está conectado. Conoce a Pip y explora servicios ficticios sin datos personales."}
            </p>
          </div>
        ) : !enabled ? (
          <p role="status" className="notice">
            {en
              ? "Email sign-in is being set up. Please check back soon."
              : "Estamos configurando el inicio por correo. Vuelve pronto."}
          </p>
        ) : null}
        <form onSubmit={send}>
          <label htmlFor="welcome-email">
            {en ? "Email address" : "Correo electrónico"}
          </label>
          <input
            id="welcome-email"
            type="email"
            autoComplete="email"
            maxLength={200}
            required
            value={email}
            disabled={!enabled || busy || sent}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          {sent && (
            <>
              <label htmlFor="welcome-code">
                {en ? "6-digit code" : "Código de 6 dígitos"}
              </label>
              <input
                id="welcome-code"
                className="login-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                disabled={busy}
              />
            </>
          )}
          <button className="button full" disabled={!enabled || busy}>
            {busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <>
                {sent
                  ? en
                    ? "Sign in"
                    : "Iniciar sesión"
                  : en
                    ? "Email me a code"
                    : "Envíame un código"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          {sent && (
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setCode("");
                setError("");
              }}
            >
              {en
                ? "Change email or request a new code"
                : "Cambiar correo o pedir otro código"}
            </button>
          )}
        </form>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {demo && (
          <button
            type="button"
            className="button full demo-preview"
            disabled={busy}
            onClick={preview}
          >
            {en ? "Meet Pip · Try the demo" : "Conoce a Pip · Prueba la demo"}
            <ArrowRight size={18} />
          </button>
        )}
        <p className="welcome-privacy">
          <ShieldCheck size={18} />
          {en
            ? "Your food preferences stay in this tab and clear when you reload or sign out."
            : "Tus preferencias quedan en esta pestaña y se borran al recargar o cerrar sesión."}
        </p>
        <div className="welcome-links">
          <Link href="/privacy">{en ? "Privacy" : "Privacidad"}</Link>
          <Link href="/provider/login">
            {en
              ? "Provider or admin sign-in"
              : "Acceso para proveedores y administradores"}
          </Link>
        </div>
      </div>
    </section>
  );
}
