import Link from "next/link";
export default function NotFound() {
  return (
    <section className="container page-space">
      <h1>404</h1>
      <p>Page not found · Página no encontrada</p>
      <Link className="button" href="/">
        PantryFit
      </Link>
    </section>
  );
}
