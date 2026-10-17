"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  defaultPreferences,
  type HouseholdPreferences,
  type Locale,
  type Provider,
} from "@/lib/model";
import { dictionaries } from "@/lib/i18n";
import { demoProviders } from "@/lib/data";
const Context = createContext<null | {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: typeof dictionaries.en;
  preferences: HouseholdPreferences;
  setPreferences: (p: HouseholdPreferences) => void;
  providers: Provider[];
  demo: boolean;
  demoAuth: boolean;
  loadError: boolean;
  refresh: () => void;
}>(null);
export function AppContext({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [providers, setProviders] = useState(demoProviders);
  const [demo, setDemo] = useState(true);
  const [demoAuth, setDemoAuth] = useState(false);
  const [loadError, setLoadError] = useState(false);
  function refresh() {
    fetch("/api/providers")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        setProviders(d.providers);
        setDemo(d.demo);
        setDemoAuth(d.demoAuth);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <Context.Provider
      value={{
        locale,
        setLocale,
        t: dictionaries[locale],
        preferences,
        setPreferences,
        providers,
        demo,
        demoAuth,
        loadError,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const c = useContext(Context);
  if (!c) throw Error("Missing AppContext");
  return c;
}
