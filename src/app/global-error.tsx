"use client";
import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main
          style={{
            maxWidth: 640,
            margin: "4rem auto",
            padding: "1rem",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <h1>PantryFit is temporarily unavailable</h1>
          <p>Please try again. Reloading clears your unsaved preferences.</p>
          <div lang="es">
            <h2>PantryFit no está disponible temporalmente</h2>
            <p>
              Inténtalo de nuevo. Recargar borra tus preferencias sin guardar.
            </p>
          </div>
          <button onClick={reset}>Try again / Intentar otra vez</button>{" "}
          <Link href="/">Home / Inicio</Link>
        </main>
      </body>
    </html>
  );
}
