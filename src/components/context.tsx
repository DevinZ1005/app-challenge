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
  loading: boolean;
  refresh: () => void;
}>(null);
export function AppContext({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [demo, setDemo] = useState(false);
  const [demoAuth, setDemoAuth] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  function refresh() {
    setLoading(true);
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
      .catch(() => {
        setProviders([]);
        setDemo(false);
        setDemoAuth(false);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
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
        loading,
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
