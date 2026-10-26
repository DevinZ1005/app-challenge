// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DirectionsLink } from "../src/components/directions-link";
import { Home } from "../src/components/home";
import { Results, ProviderDetail } from "../src/components/results";
import { demoProviders } from "../src/lib/data";
import { defaultPreferences } from "../src/lib/model";
import { en, es } from "../src/lib/i18n";

const state = vi.hoisted(() => ({
  spanish: false,
  providers: [] as import("../src/lib/model").Provider[],
}));
vi.mock("../src/components/context", () => ({
  useApp: () => ({
    locale: state.spanish ? "es" : "en",
    t: state.spanish ? es : en,
    providers: state.providers,
    preferences: defaultPreferences,
    demo: false,
    loading: false,
    loadError: false,
  }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
function pantry() {
  return {
    ...structuredClone(demoProviders[0]),
    id: "khcc-test",
    demo: false,
    name: {
      en: "Kingsbridge Heights Community Center",
      es: "Centro Comunitario Kingsbridge Heights (KHCC)",
    },
    address: {
      en: "3101 Kingsbridge Terrace, Bronx, NY 10463",
      es: "3101 Kingsbridge Terrace, Bronx, NY 10463",
    },
    coordinatesVerified: false,
  };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  state.spanish = false;
  state.providers = [];
});
it("links using a public address without verified coordinates or a location request", () => {
  const geolocate = vi.fn();
  const fetcher = vi.fn();
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition: geolocate },
  });
  vi.stubGlobal("fetch", fetcher);
  render(<DirectionsLink provider={pantry()} />);
  const link = screen.getByRole("link", { name: "Get Directions" });
  expect(
    new URL(link.getAttribute("href")!).searchParams.get("destination"),
  ).toBe(pantry().address.en);
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(new URL(link.getAttribute("href")!).searchParams.has("origin")).toBe(
    false,
  );
  expect(geolocate).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});
it("uses the Spanish label and currently displayed public address", () => {
  state.spanish = true;
  const provider = pantry();
  provider.address.es = "10 Calle José & Ana, Bronx, NY";
  render(<DirectionsLink provider={provider} />);
  const link = screen.getByRole("link", { name: "Cómo llegar" });
  expect(
    new URL(link.getAttribute("href")!).searchParams.get("destination"),
  ).toBe(provider.address.es);
});
it("hides links for missing localized addresses and fictional demo locations", () => {
  const provider = pantry();
  provider.address.en = "  ";
  const view = render(<DirectionsLink provider={provider} />);
  expect(screen.queryByRole("link")).toBeNull();
  provider.address = undefined as unknown as typeof provider.address;
  view.rerender(<DirectionsLink provider={provider} />);
  expect(screen.queryByRole("link")).toBeNull();
  view.rerender(<DirectionsLink provider={{ ...pantry(), demo: true }} />);
  expect(screen.queryByRole("link")).toBeNull();
});
it.each(["home", "results", "detail"])(
  "shows directions wherever an individual pantry address appears: %s",
  (surface) => {
    const provider = pantry();
    state.providers = [provider];
    const component =
      surface === "home" ? (
        <Home />
      ) : surface === "results" ? (
        <Results />
      ) : (
        <ProviderDetail id={provider.id} />
      );
    render(component);
    const link = screen.getByRole("link", { name: "Get Directions" });
    expect(
      new URL(link.getAttribute("href")!).searchParams.get("destination"),
    ).toBe(provider.address.en);
    expect(link.closest("a a")).toBeNull();
    expect(screen.getAllByText(provider.address.en).length).toBeGreaterThan(0);
  },
);
it.each(["home", "results", "detail"])(
  "hides directions with no usable address on %s",
  (surface) => {
    const provider = pantry();
    provider.address = { en: "", es: "" };
    state.providers = [provider];
    render(
      surface === "home" ? (
        <Home />
      ) : surface === "results" ? (
        <Results />
      ) : (
        <ProviderDetail id={provider.id} />
      ),
    );
    expect(screen.queryByRole("link", { name: "Get Directions" })).toBeNull();
  },
);
