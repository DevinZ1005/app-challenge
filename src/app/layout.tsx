import type { Metadata } from "next";
import { connection } from "next/server";
import { AppContext } from "@/components/context";
import { Header, Footer } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "PantryFit — Food assistance that fits your life",
    template: "%s · PantryFit",
  },
  description:
    "A bilingual food-assistance matching prototype for the Bronx. Compare schedules, cooking needs, storage, and information confidence.",
  robots: { index: false, follow: false },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A fresh request is required for each script nonce; do not prerender HTML.
  await connection();
  return (
    <html lang="en">
      <body>
        <AppContext>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </AppContext>
      </body>
    </html>
  );
}
