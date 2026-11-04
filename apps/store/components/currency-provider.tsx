"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "@ryanmeetup/ui";
import { currencyStorageKey, isDisplayCurrency, parseCurrencyRates } from "@/lib/currency";
import type { CurrencyRates, DisplayCurrency } from "@/lib/currency";

type CurrencyContextValue = {
  currency: DisplayCurrency;
  rates: CurrencyRates | null;
  loading: boolean;
  selectCurrency: (next: DisplayCurrency) => Promise<void>;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);
const unavailable = "Currency conversion is unavailable right now. Please try again.";

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<DisplayCurrency>("USD");
  const [rates, setRates] = useState<CurrencyRates | null>(null);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const request = useRef<Promise<CurrencyRates> | null>(null);
  const busy = useRef(false);
  const changes = useRef(0);

  const loadRates = useCallback(() => {
    if (!request.current) {
      request.current = fetch("/api/currency-rates", { signal: AbortSignal.timeout(8000) })
        .then(async (response) => {
          if (!response.ok) throw new Error(unavailable);
          return parseCurrencyRates(await response.json());
        })
        .catch((error: unknown) => {
          request.current = null;
          throw error;
        });
    }
    return request.current;
  }, []);

  useEffect(() => {
    let active = true;
    const startedAt = changes.current;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(currencyStorageKey);
    } catch {
      // A blocked browser store still allows switching currency for this visit.
    }
    if (isDisplayCurrency(saved) && saved !== "USD") {
      const storedCurrency = saved;
      void loadRates().then((data) => {
        if (!active || changes.current !== startedAt) return;
        setRates(data);
        setCurrency(storedCurrency);
      }).catch(() => {
        if (active && changes.current === startedAt) toast.error(unavailable, { id: "currency-unavailable" });
      });
    }
    return () => { active = false; };
  }, [loadRates]);

  const selectCurrency = useCallback(async (next: DisplayCurrency) => {
    if (busy.current || next === currency) return;
    busy.current = true;
    changes.current += 1;
    setLoading(true);
    try {
      if (next !== "USD") setRates(await loadRates());
      setCurrency(next);
      setAnnouncement(next === "USD" ? "Prices shown in USD." : `Estimated prices shown in ${next}. Checkout is charged in USD.`);
      try {
        window.localStorage.setItem(currencyStorageKey, next);
      } catch {
        // The active preference still lasts until the page is closed.
      }
    } catch {
      toast.error(unavailable, { id: "currency-unavailable" });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [currency, loadRates]);

  const value = useMemo(() => ({ currency, rates, loading, selectCurrency }), [currency, rates, loading, selectCurrency]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
      <span className="sr-only" role="status">{announcement}</span>
    </CurrencyContext.Provider>
  );
}

export function useDisplayCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useDisplayCurrency must be used inside CurrencyProvider.");
  return context;
}
